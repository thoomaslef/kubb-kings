import { useGameStore } from '../store/useGameStore';
import { useT } from '../i18n/useT';
import type { Lang } from '../i18n/translate';

const LANGS: Lang[] = ['fr', 'en'];
const LANG_AUTONYM: Record<Lang, string> = { fr: 'Français', en: 'English' };
const LANG_FLAG: Record<Lang, string> = { fr: '🇫🇷', en: '🇬🇧' };

/** Reglages de l'appareil : pour l'instant la langue (d'autres viendront ici plutot qu'au menu). */
export function Options() {
  const t = useT();
  const setScreen = useGameStore((s) => s.setScreen);
  const lang = useGameStore((s) => s.lang);
  const setLang = useGameStore((s) => s.setLang);

  return (
    <div className="overlay overlay--solid">
      <div className="panel">
        <h2 className="panel__title">{t('options.title')}</h2>
        <div className="button-column">
          <p className="segmented-label">{t('menu.langAria')}</p>
          <div className="segmented" role="group" aria-label={t('menu.langAria')}>
            {LANGS.map((code) => (
              <button
                key={code}
                className={`segmented__item${code === lang ? ' segmented__item--on' : ''}`}
                aria-pressed={code === lang}
                onClick={() => setLang(code)}
              >
                <span aria-hidden="true">{LANG_FLAG[code]}</span> {LANG_AUTONYM[code]}
              </button>
            ))}
          </div>

          <button className="btn btn--ghost" onClick={() => setScreen('menu')}>
            {t('hub.back')}
          </button>
        </div>
      </div>
    </div>
  );
}
