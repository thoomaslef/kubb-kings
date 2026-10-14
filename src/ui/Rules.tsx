import { useGameStore } from '../store/useGameStore';
import { KUBBS_PER_TEAM, MAX_THROWS_PER_TEAM } from '../game/rules';
import { useT } from '../i18n/useT';

export function Rules() {
  const t = useT();
  const setScreen = useGameStore((s) => s.setScreen);

  return (
    <div className="overlay overlay--solid">
      <div className="panel panel--scroll">
        <h2 className="panel__title">{t('rules.title')}</h2>

        <ol className="rules-list">
          <li>{t('rules.item1', { n: KUBBS_PER_TEAM })}</li>
          <li>{t('rules.item2')}</li>
          <li>{t('rules.item3')}</li>
          <li>{t('rules.item4')}</li>
          <li>{t('rules.item5')}</li>
          <li>{t('rules.item6')}</li>
          <li>{t('rules.item7', { n: MAX_THROWS_PER_TEAM })}</li>
          <li>{t('rules.item8')}</li>
        </ol>

        <div className="button-column">
          <button className="btn btn--primary" onClick={() => setScreen('menu')}>
            {t('rules.back')}
          </button>
        </div>
      </div>
    </div>
  );
}
