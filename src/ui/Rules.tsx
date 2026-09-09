import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { KUBBS_PER_TEAM, MAX_THROWS_PER_TEAM } from '../game/rules';
import { resetTutorial } from '../game/tutorial';
import { useT } from '../i18n/useT';

export function Rules() {
  const t = useT();
  const setScreen = useGameStore((s) => s.setScreen);
  const [tutorialReset, setTutorialReset] = useState(false);

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
          <li>{t('rules.item7')}</li>
          <li>{t('rules.item8', { n: MAX_THROWS_PER_TEAM })}</li>
        </ol>

        <div className="button-column">
          <button className="btn btn--primary" onClick={() => setScreen('menu')}>
            {t('rules.back')}
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => {
              resetTutorial();
              setTutorialReset(true);
            }}
          >
            {t(tutorialReset ? 'rules.tutorialWillReplay' : 'rules.replayTutorial')}
          </button>
        </div>
      </div>
    </div>
  );
}
