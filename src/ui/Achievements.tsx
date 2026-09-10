import { useGameStore } from '../store/useGameStore';
import { ACHIEVEMENTS } from '../game/achievements';
import { useT } from '../i18n/useT';

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
                  <span className="shop-item__hint">{t(`achievement.${achievement.id}.hint`)}</span>
                  <span className="shop-item__hint">
                    {t('achievements.reward', { xp: achievement.xp, coins: achievement.coins })}
                  </span>
                </div>
                <span className={earned ? 'shop-item__owned' : 'shop-item__status'}>
                  {t(earned ? 'achievements.earned' : 'achievements.locked')}
                </span>
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
