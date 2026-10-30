import { AI_PROFILES, type Difficulty } from '../game/ai';
import { useGameStore } from '../store/useGameStore';
import { useT } from '../i18n/useT';
import { accountAvailable } from '../game/account/sync';

const LEVELS = Object.keys(AI_PROFILES) as Difficulty[];

/** Les modes qui se jouent sur un seul telephone : solo contre l'IA, 1v1, 2v2, tournoi local. */
export function LocalHub() {
  const t = useT();
  const setScreen = useGameStore((s) => s.setScreen);
  const openMapSelect = useGameStore((s) => s.openMapSelect);
  const difficulty = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);

  return (
    <div className="overlay overlay--solid">
      <div className="panel">
        <h2 className="panel__title">{t('hub.local.title')}</h2>
        <div className="button-column">
          <button className="btn btn--primary" onClick={() => openMapSelect('solo')}>
            {t('menu.solo')}
          </button>

          <p className="segmented-label">{t('menu.aiLevelAria')}</p>
          <div className="segmented" role="group" aria-label={t('menu.aiLevelAria')}>
            {LEVELS.map((level) => (
              <button
                key={level}
                className={`segmented__item${level === difficulty ? ' segmented__item--on' : ''}`}
                aria-pressed={level === difficulty}
                onClick={() => setDifficulty(level)}
              >
                {t(`difficulty.${level}.label`)}
              </button>
            ))}
          </div>
          <p className="footnote footnote--tight">{t(`difficulty.${difficulty}.hint`)}</p>

          <button className="btn" onClick={() => openMapSelect('local')}>
            {t('menu.local1v1')}
          </button>
          <button className="btn" onClick={() => openMapSelect('2v2')}>
            {t('menu.local2v2')}
          </button>

          <button className="btn" onClick={() => openMapSelect('tournament')}>
            {t('menu.tournament')}
          </button>

          <button className="btn btn--ghost" onClick={() => setScreen('menu')}>
            {t('hub.back')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Jouer en ligne : deux choix, trouver un adversaire (partie classee) ou jouer avec un ami (code). */
export function OnlineHub() {
  const t = useT();
  const setScreen = useGameStore((s) => s.setScreen);
  const openMapSelect = useGameStore((s) => s.openMapSelect);
  const account = useGameStore((s) => s.account);
  const setAfterLogin = useGameStore((s) => s.setAfterLogin);

  // Un compte est exige pour jouer en ligne : c'est lui qui donne un pseudo au classement et qui permet de signaler un
  // joueur. Les modes hors ligne n'en demandent jamais. Sans service de compte configure (developpement), pas d'exigence.
  if (accountAvailable() && account.status !== 'signedIn') {
    const goToAccount = () => {
      setAfterLogin('online-hub');
      setScreen('account');
    };
    return (
      <div className="overlay overlay--solid">
        <div className="panel">
          <h2 className="panel__title">{t('hub.online.title')}</h2>
          {account.status === 'checking' ? (
            <p className="panel__text">{t('hub.online.checking')}</p>
          ) : (
            <>
              <p className="panel__text" data-testid="online-needs-account">
                {t('hub.online.needsAccount')}
              </p>
              <div className="button-column">
                <button className="btn btn--primary" onClick={goToAccount}>
                  {t('hub.online.createAccount')}
                </button>
              </div>
            </>
          )}
          <div className="button-column">
            <button className="btn btn--ghost" onClick={() => setScreen('menu')}>
              {t('hub.back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const find = () => {
    useGameStore.getState().setRankedLobby(true);
    setScreen('online');
  };

  return (
    <div className="overlay overlay--solid">
      <div className="panel">
        <h2 className="panel__title">{t('hub.online.title')}</h2>
        <div className="button-column">
          <button className="btn btn--primary" onClick={find}>
            {t('hub.online.find')}
          </button>
          <button className="btn" onClick={() => openMapSelect('online')}>
            {t('menu.online')}
          </button>
          <button className="btn btn--ghost" onClick={() => setScreen('menu')}>
            {t('hub.back')}
          </button>
        </div>
      </div>
    </div>
  );
}
