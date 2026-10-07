import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { bridge } from '../game/GameBridge';
import { createRoomCode } from '../game/online/localTransport';
import {
  Matchmaker,
  QUEUE_BOT_AFTER_MS,
  QUEUE_CHANNEL,
  QUEUE_CHANNEL_RANKED,
  type QueueMessage
} from '../game/online/matchmaking';
import { createMatchTransport, transportKind } from '../game/online/transportFactory';
import { setCurrentSession } from '../game/online/currentSession';
import { OnlineSession } from '../game/online/session';
import { PROTOCOL_VERSION, type MatchSetup, type PlayerCard } from '../game/online/protocol';
import { WIND_DIRECTIONS, drawStartingTeam, type FieldPresetId } from '../game/rules';
import type { BatonId } from '../game/batons';
import { levelFromXp } from '../game/progression';
import { useRankName } from './RankBadge';
import { useT } from '../i18n/useT';

/**
 * Salon d'une partie privee : on cree (et on partage un code) ou on
 * rejoint. Tant qu'un vrai transport n'est pas branche, les deux joueurs
 * doivent etre dans deux onglets du MEME navigateur — c'est la limite du
 * faux transport local, dite clairement a l'ecran plutot que subie.
 */

/** Conditions de la partie, tirees par l'hote : lui seul decide, sinon les deux camps ne joueraient pas la meme. */
function drawSetup(
  fieldPreset: FieldPresetId,
  windEnabled: boolean,
  fieldKubbsEnabled: boolean,
  batonId: BatonId
): MatchSetup {
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
    // L'hote inscrit SON projectile ; celui de l'invite arrive avec sa
    // presentation (cf. session.ts) et remplace cette valeur d'attente. Un
    // baton a un effet de jeu reel : le forcer priverait chacun de l'objet
    // qu'il a achete.
    batons: { blue: batonId, red: 'base' },
    startingTeam: drawStartingTeam()
  };
}

export function OnlineLobby() {
  const t = useT();
  const rankName = useRankName();
  const rankedLobby = useGameStore((s) => s.rankedLobby);
  const setRankedLobby = useGameStore((s) => s.setRankedLobby);
  const rank = useGameStore((s) => s.rank);
  const setScreen = useGameStore((s) => s.setScreen);
  const setMode = useGameStore((s) => s.setMode);
  const startOnline = useGameStore((s) => s.startOnline);
  const patchOnline = useGameStore((s) => s.patchOnline);
  const endOnline = useGameStore((s) => s.endOnline);
  const online = useGameStore((s) => s.online);
  const fieldPreset = useGameStore((s) => s.fieldPreset);
  const windEnabled = useGameStore((s) => s.windEnabled);
  const fieldKubbsEnabled = useGameStore((s) => s.fieldKubbsEnabled);
  const batonId = useGameStore((s) => s.batonId);
  const progression = useGameStore((s) => s.progression);
  // Ce qu'on annonce de soi : pour l'instant le seul niveau, que l'adversaire
  // n'a aucun autre moyen de connaitre (cf. succes "Tombeur de geant").
  const card: PlayerCard = { level: levelFromXp(progression.totalXp).level };

  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<OnlineSession | null>(null);

  // Recherche rapide (cf. game/online/matchmaking.ts).
  /** Recherche en cours : heure d'arrivee en file (pour garder son rang si on la relance). */
  const [searching, setSearching] = useState<{ since: number; ranked: boolean } | null>(null);
  const [waitedMs, setWaitedMs] = useState(0);
  const [queueSize, setQueueSize] = useState(1);
  /** Salon ouvert par la recherche : on n'affiche pas un code a partager, personne n'en a besoin. */
  const [quickRoom, setQuickRoom] = useState(false);
  const matchmakerRef = useRef<Matchmaker | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kind = transportKind();

  // Liaison impossible a etablir (projet injoignable, cle invalide) : sans
  // cela le salon tournerait indefiniment sur « en attente de l'adversaire »
  // alors que personne n'ecoute a l'autre bout.
  const onTransportError = () => {
    sessionRef.current = null;
    setCurrentSession(null);
    endOnline();
    setError(t('online.connectionFailed'));
  };

  // Le salon ne doit pas survivre a l'ecran : sans ca, un retour au menu
  // laisserait une session ouverte qui continuerait d'accueillir. Nettoyage
  // au DEMONTAGE seulement : dependre du statut faisait tourner le nettoyage
  // a chaque changement d'etat, donc juste apres la creation du salon — qui
  // se refermait aussitot. Le statut est lu via une ref pour rester a jour
  // sans reintroduire de dependance.
  useEffect(
    () => () => {
      stopSearch();
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
    // Une revanche rejoue le meme terrain avec les memes projectiles, mais
    // REDISTRIBUE le vent et le premier joueur : sans cela, celui que le
    // tirage avait favorise le resterait indefiniment. Seul l'hote tire, ici
    // comme pour la partie initiale.
    session.provideRematchSetup(() => {
      const previous = session.setup;
      const drawn = drawSetup(
        previous?.fieldPreset ?? fieldPreset,
        windEnabled,
        previous?.fieldKubbsEnabled ?? fieldKubbsEnabled,
        batonId
      );
      return { ...drawn, batons: previous?.batons ?? drawn.batons };
    });
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

  const host = (roomCode?: string, ranked = false) => {
    setError(null);
    const code = roomCode ?? createRoomCode();
    startOnline(code, 'host', ranked);
    wire(
      OnlineSession.host(
        createMatchTransport(code, onTransportError),
        // Partie classee : conditions fixes, les memes pour tous (terrain
        // classique, sans vent ni kubb de champ, projectile de base). Rien de
        // ce qu'on a achete ou regle au menu n'entre en jeu.
        ranked
          ? drawSetup('classique', false, false, 'base')
          : drawSetup(fieldPreset, windEnabled, fieldKubbsEnabled, batonId),
        `hote-${code}`,
        card
      )
    );
  };

  const join = (roomCode?: string, ranked = false) => {
    const code = (roomCode ?? joinCode).trim().toUpperCase();
    if (code.length < 3) {
      setError(t('online.badCode'));
      return;
    }
    setError(null);
    startOnline(code, 'guest', ranked);
    wire(
      OnlineSession.join(createMatchTransport(code, onTransportError), `invite-${code}`, ranked ? 'base' : batonId, card)
    );
  };

  /** Arrete la recherche : minuteurs, file d'attente (qui previent les autres) et salon d'attente. */
  function stopSearch() {
    if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    searchTimerRef.current = null;
    if (roomTimerRef.current) clearTimeout(roomTimerRef.current);
    roomTimerRef.current = null;
    matchmakerRef.current?.stop();
    matchmakerRef.current = null;
  }

  /** Delai laisse a l'autre joueur pour rejoindre le salon qu'on vient d'annoncer. */
  const ROOM_WAIT_MS = 15_000;

  /**
   * Entre en file. `since` : heure d'arrivee d'origine, quand on relance la
   * recherche apres un couplage qui n'a pas abouti — on ne perd pas son rang,
   * et le bot arrive a l'heure prevue depuis le TOUT premier clic.
   */
  const startSearch = (since?: number, ranked = false) => {
    stopSearch();
    setError(null);
    setQuickRoom(false);
    const transport = createMatchTransport<QueueMessage>(ranked ? QUEUE_CHANNEL_RANKED : QUEUE_CHANNEL, () => {
      stopSearch();
      setSearching(null);
      setError(t('online.connectionFailed'));
    });
    const matchmaker = new Matchmaker({
      playerId: `file-${createRoomCode(8)}`,
      transport,
      since,
      onMatch: ({ role, code }) => {
        const arrivedAt = matchmakerRef.current?.since ?? since ?? Date.now();
        if (searchTimerRef.current) clearInterval(searchTimerRef.current);
        searchTimerRef.current = null;
        matchmakerRef.current = null;
        setSearching(null);
        setQuickRoom(true);
        if (role === 'host') host(code, ranked);
        else join(code, ranked);
        // Une course rare peut laisser un salon sans invite : au bout d'un
        // moment, on abandonne ce salon et on retourne en file.
        roomTimerRef.current = setTimeout(() => {
          if (useGameStore.getState().online?.status !== 'attente') return;
          sessionRef.current?.leave();
          sessionRef.current = null;
          setCurrentSession(null);
          endOnline();
          startSearch(arrivedAt, ranked);
        }, ROOM_WAIT_MS);
      },
      onBot: () => {
        if (searchTimerRef.current) clearInterval(searchTimerRef.current);
        searchTimerRef.current = null;
        matchmakerRef.current = null;
        setSearching(null);
        // Personne n'est venu en une minute : un bot, en difficile. En classe,
        // c'est de l'entrainement : le rang n'est jamais en jeu (aucune partie
        // en ligne n'a lieu, rien n'est enregistre).
        useGameStore.getState().startBotMatch();
        bridge.send('start-match');
      }
    });
    matchmakerRef.current = matchmaker;
    setSearching({ since: matchmaker.since, ranked });
    setWaitedMs(Date.now() - matchmaker.since);
    setQueueSize(1);
    searchTimerRef.current = setInterval(() => {
      matchmaker.tick();
      setWaitedMs(Date.now() - matchmaker.since);
      setQueueSize(matchmaker.queueSize);
    }, 1000);
  };

  // Arrive par l'ecran des rangs : la recherche classee demarre d'elle-meme.
  useEffect(() => {
    if (rankedLobby && kind !== 'aucun' && !useGameStore.getState().online) startSearch(undefined, true);
    // Une seule fois a l'arrivee sur l'ecran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const back = () => {
    stopSearch();
    setSearching(null);
    setQuickRoom(false);
    setRankedLobby(false);
    sessionRef.current?.leave();
    sessionRef.current = null;
    setCurrentSession(null);
    endOnline();
    setScreen('menu');
  };

  if (kind === 'aucun') {
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

  // Dire la portee reelle du mode en ligne plutot que de la laisser
  // decouvrir : avec le transport local, l'adversaire doit etre dans un autre
  // onglet du MEME navigateur.
  const hintKey = kind === 'supabase' ? 'online.anyDeviceHint' : 'online.sameBrowserHint';

  // Salon ouvert : on attend l'adversaire.
  if (online && online.status === 'attente') {
    return (
      <div className="overlay overlay--solid">
        <div className="panel">
          <h2 className="panel__title">{t('online.waitingTitle')}</h2>
          {quickRoom ? (
            <p className="panel__text">{t(online?.ranked ? 'online.rankedFound' : 'online.quickFound')}</p>
          ) : online.role === 'host' ? (
            <>
              <p className="panel__text">{t('online.shareCode')}</p>
              <p className="title" style={{ letterSpacing: '0.35em' }}>
                {online.roomCode}
              </p>
            </>
          ) : (
            <p className="panel__text">{t('online.joining', { code: online.roomCode })}</p>
          )}
          {!quickRoom && <p className="footnote">{t(hintKey)}</p>}
          <div className="button-column">
            <button className="btn btn--ghost" onClick={back}>
              {t('online.cancel')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Recherche rapide : on attend qu'un autre joueur arrive, ou le bot.
  if (searching) {
    const leftS = Math.max(0, Math.ceil((QUEUE_BOT_AFTER_MS - waitedMs) / 1000));
    return (
      <div className="overlay overlay--solid">
        <div className="panel">
          <h2 className="panel__title">{t(searching.ranked ? 'online.rankedTitle' : 'online.searchingTitle')}</h2>
          <p className="panel__text">
            {searching.ranked
              ? t('online.rankedText', { rank: rankName(rank.index), n: queueSize, s: leftS })
              : t('online.searchingText', { n: queueSize, s: leftS })}
          </p>
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
        <p className="footnote">{t(hintKey)}</p>

        <div className="button-column">
          <button className="btn btn--primary" onClick={() => startSearch()}>
            {t('online.quick')}
          </button>
          <p className="footnote footnote--tight">{t('online.quickHint')}</p>

          <button className="btn" onClick={() => host()}>
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
          <button className="btn" onClick={() => join()}>
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
