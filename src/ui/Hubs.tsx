import { AI_PROFILES, type Difficulty } from '../game/ai';
import { useGameStore } from '../store/useGameStore';
import { useT } from '../i18n/useT';
import { RankBadge, useRankName } from './RankBadge';

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

/** Les trois facons de jouer en ligne : rapide (inconnu), privee (code), classee (rang). */
export function OnlineHub() {
  const t = useT();
  const rankName = useRankName();
  const rank = useGameStore((s) => s.rank);
  const setScreen = useGameStore((s) => s.setScreen);
  const openMapSelect = useGameStore((s) => s.openMapSelect);

  const quick = () => {
    const state = useGameStore.getState();
    state.setRankedLobby(false);
    state.setQuickLobby(true);
    setScreen('online');
  };

  return (
    <div className="overlay overlay--solid">
      <div className="panel">
        <h2 className="panel__title">{t('hub.online.title')}</h2>
        <p className="panel__text">{t('hub.online.intro')}</p>
        <div className="button-column">
          <button className="btn btn--primary" onClick={quick}>
            {t('online.quick')}
          </button>
          <p className="footnote footnote--tight">{t('online.quickHint')}</p>

          <button className="btn" onClick={() => openMapSelect('online')}>
            {t('menu.online')}
          </button>
          <p className="footnote footnote--tight">{t('hub.online.privateHint')}</p>

          <button className="btn btn--ranked" onClick={() => setScreen('ranks')}>
            <RankBadge index={rank.index} size="sm" />
            {t('menu.ranked', { rank: rankName(rank.index) })}
          </button>
          <p className="footnote footnote--tight">{t('hub.online.rankedHint')}</p>

          <button className="btn btn--ghost" onClick={() => setScreen('menu')}>
            {t('hub.back')}
          </button>
        </div>
      </div>
    </div>
  );
}
