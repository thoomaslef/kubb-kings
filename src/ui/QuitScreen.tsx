import { useGameStore } from '../store/useGameStore';
import { useT } from '../i18n/useT';

export function QuitScreen() {
  const t = useT();
  const setScreen = useGameStore((s) => s.setScreen);

  return (
    <div className="overlay overlay--solid">
      <div className="panel">
        <h2 className="panel__title">{t('quit.title')}</h2>
        <p className="panel__text">{t('quit.text')}</p>
        <button className="btn btn--primary" onClick={() => setScreen('menu')}>
          {t('quit.back')}
        </button>
      </div>
    </div>
  );
}
