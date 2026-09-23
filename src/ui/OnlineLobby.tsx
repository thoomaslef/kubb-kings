import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { bridge } from '../game/GameBridge';
import { createLocalTransport, createRoomCode, isLocalTransportAvailable } from '../game/online/localTransport';
import { setCurrentSession } from '../game/online/currentSession';
import { OnlineSession } from '../game/online/session';
import { PROTOCOL_VERSION, type MatchSetup } from '../game/online/protocol';
import { WIND_DIRECTIONS, type FieldPresetId } from '../game/rules';
import { useT } from '../i18n/useT';

/**
 * Salon d'une partie privee : on cree (et on partage un code) ou on
 * rejoint. Tant qu'un vrai transport n'est pas branche, les deux joueurs
 * doivent etre dans deux onglets du MEME navigateur — c'est la limite du
 * faux transport local, dite clairement a l'ecran plutot que subie.
 */

/** Conditions de la partie, tirees par l'hote : lui seul decide, sinon les deux camps ne joueraient pas la meme. */
function drawSetup(fieldPreset: FieldPresetId, windEnabled: boolean, fieldKubbsEnabled: boolean): MatchSetup {
  return {
    version: PROTOCOL_VERSION,
    fieldPreset,
    wind: windEnabled
      ? {
          direction: WIND_DIRECTIONS[Math.floor(Math.random() * WIND_DIRECTIONS.length)],
          force: Math.random() < 0.5 ? 1 : 2
        }
      : null,
    fieldKubbsEnabled,
    // Les deux joueurs partent avec le baton de base : echanger les choix de
    // chacun demanderait un aller-retour de plus dans la poignee de main.
    batons: { blue: 'base', red: 'base' },
    startingTeam: Math.random() < 0.5 ? 'blue' : 'red'
  };
}

export function OnlineLobby() {
  const t = useT();
  const setScreen = useGameStore((s) => s.setScreen);
  const setMode = useGameStore((s) => s.setMode);
  const startOnline = useGameStore((s) => s.startOnline);
  const patchOnline = useGameStore((s) => s.patchOnline);
  const endOnline = useGameStore((s) => s.endOnline);
  const online = useGameStore((s) => s.online);
  const fieldPreset = useGameStore((s) => s.fieldPreset);
  const windEnabled = useGameStore((s) => s.windEnabled);
  const fieldKubbsEnabled = useGameStore((s) => s.fieldKubbsEnabled);

  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<OnlineSession | null>(null);

  // Le salon ne doit pas survivre a l'ecran : sans ca, un retour au menu
  // laisserait une session ouverte qui continuerait d'accueillir. Nettoyage
  // au DEMONTAGE seulement : dependre du statut faisait tourner le nettoyage
  // a chaque changement d'etat, donc juste apres la creation du salon — qui
  // se refermait aussitot. Le statut est lu via une ref pour rester a jour
  // sans reintroduire de dependance.
  useEffect(
    () => () => {
      // Statut lu dans le store AU DEMONTAGE, pas via une valeur capturee
      // au rendu : quand la partie demarre, l'ecran bascule sur le match
      // avant que React ait re-rendu ce composant — une valeur de rendu
      // vaudrait encore 'attente' et on fermerait la session qui vient de
      // s'etablir.
      if (useGameStore.getState().online?.status !== 'en-jeu') {
        sessionRef.current?.leave();
        sessionRef.current = null;
        setCurrentSession(null);
      }
    },
    []
  );

  const wire = (session: OnlineSession) => {
    sessionRef.current = session;
    setCurrentSession(session);
    session.onReady(() => {
      patchOnline({ status: 'en-jeu', team: session.localTeam });
      setMode('online');
      useGameStore.getState().setProfileTeam(session.localTeam ?? 'blue');
      bridge.send('start-match');
    });
    session.onClosed((reason) => {
      patchOnline({ status: 'terminee', endedBecause: reason });
    });
  };

  const host = () => {
    setError(null);
    const code = createRoomCode();
    startOnline(code, 'host');
    wire(OnlineSession.host(createLocalTransport(code), drawSetup(fieldPreset, windEnabled, fieldKubbsEnabled), `hote-${code}`));
  };

  const join = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 3) {
      setError(t('online.badCode'));
      return;
    }
    setError(null);
    startOnline(code, 'guest');
    wire(OnlineSession.join(createLocalTransport(code), `invite-${code}`));
  };

  const back = () => {
    sessionRef.current?.leave();
    sessionRef.current = null;
    setCurrentSession(null);
    endOnline();
    setScreen('menu');
  };

  if (!isLocalTransportAvailable()) {
    return (
      <div className="overlay overlay--solid">
        <div className="panel">
          <h2 className="panel__title">{t('online.title')}</h2>
          <p className="panel__text">{t('online.unsupported')}</p>
          <div className="button-column">
            <button className="btn btn--ghost" onClick={back}>
              {t('online.back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Salon ouvert : on attend l'adversaire.
  if (online && online.status === 'attente') {
    return (
      <div className="overlay overlay--solid">
        <div className="panel">
          <h2 className="panel__title">{t('online.waitingTitle')}</h2>
          {online.role === 'host' ? (
            <>
              <p className="panel__text">{t('online.shareCode')}</p>
              <p className="title" style={{ letterSpacing: '0.35em' }}>
                {online.roomCode}
              </p>
            </>
          ) : (
            <p className="panel__text">{t('online.joining', { code: online.roomCode })}</p>
          )}
          <p className="footnote">{t('online.sameBrowserHint')}</p>
          <div className="button-column">
            <button className="btn btn--ghost" onClick={back}>
              {t('online.cancel')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay overlay--solid">
      <div className="panel">
        <h2 className="panel__title">{t('online.title')}</h2>
        <p className="panel__text">{t('online.intro')}</p>
        <p className="footnote">{t('online.sameBrowserHint')}</p>

        <div className="button-column">
          <button className="btn" onClick={host}>
            {t('online.create')}
          </button>

          <input
            className="input"
            value={joinCode}
            maxLength={6}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder={t('online.codePlaceholder')}
            aria-label={t('online.codePlaceholder')}
          />
          <button className="btn" onClick={join}>
            {t('online.join')}
          </button>
          {error && <p className="footnote">{error}</p>}

          <button className="btn btn--ghost" onClick={back}>
            {t('online.back')}
          </button>
        </div>
      </div>
    </div>
  );
}
