import { useGameStore } from '../store/useGameStore';
import {
  ACHIEVEMENTS,
  FIELD_KUBBS_CLEARED_TARGET,
  GRAZE_MAX_DISTANCE,
  type AchievementId
} from '../game/achievements';
import { FIELD_PRESETS } from '../game/rules';
import { LADDER } from '../game/roguelite';
import { useT } from '../i18n/useT';

/** Parametres d'interpolation de l'indice (achievement.<id>.hint). */
function hintParams(id: AchievementId): Record<string, number> | undefined {
  if (id === 'frolement') return { n: GRAZE_MAX_DISTANCE };
  if (id === 'nettoyeur') return { n: FIELD_KUBBS_CLEARED_TARGET };
  if (id === 'collectionneur') return { n: Object.keys(FIELD_PRESETS).length };
  if (id === 'increvable') return { n: LADDER.length };
  return undefined;
}

/** Panneau des succes : liste des defis ponctuels, possedes ou non. */
export function Achievements() {
  const t = useT();
  const setScreen = useGameStore((s) => s.setScreen);
  const unlockedAchievements = useGameStore((s) => s.unlockedAchievements);

  return (
    <div className="overlay overlay--solid">
      <div className="panel panel--scroll">
        <h2 className="panel__title">{t('achievements.title')}</h2>
        <p className="panel__text">{t('achievements.intro')}</p>

        <div className="shop-list">
          {ACHIEVEMENTS.map((achievement) => {
            const earned = unlockedAchievements.includes(achievement.id);
            return (
              <div key={achievement.id} className={`shop-item${earned ? ' shop-item--owned' : ''}`}>
                <div className="shop-item__body">
                  <span className="shop-item__label">{t(`achievement.${achievement.id}.label`)}</span>
                  <span className="shop-item__hint">
                    {t(`achievement.${achievement.id}.hint`, hintParams(achievement.id))}
                  </span>
                  <span className="shop-item__hint">
                    {t('achievements.reward', { xp: achievement.xp, coins: achievement.coins })}
                  </span>
                </div>
                <div className="shop-item__footer">
                  <span className={earned ? 'shop-item__owned' : 'shop-item__status'}>
                    {t(earned ? 'achievements.earned' : 'achievements.locked')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="button-column" style={{ marginTop: 20 }}>
          <button className="btn btn--ghost" onClick={() => setScreen('menu')}>
            {t('achievements.back')}
          </button>
        </div>
      </div>
    </div>
  );
}
