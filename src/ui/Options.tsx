import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { analyticsAvailable, analyticsChoice, setAnalyticsEnabled } from '../game/analytics';
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
  const [measure, setMeasure] = useState(analyticsChoice);

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

          {analyticsAvailable() && (
            <>
              <p className="segmented-label">{t('options.measure.label')}</p>
              <div className="segmented" role="group" aria-label={t('options.measure.label')} data-testid="measure-options">
                {([true, false] as const).map((on) => (
                  <button
                    key={String(on)}
                    className={`segmented__item${measure === on ? ' segmented__item--on' : ''}`}
                    aria-pressed={measure === on}
                    onClick={() => {
                      setAnalyticsEnabled(on);
                      setMeasure(on);
                    }}
                  >
                    {t(on ? 'options.measure.on' : 'options.measure.off')}
                  </button>
                ))}
              </div>
              <p className="footnote footnote--tight">{t('options.measure.hint')}</p>
            </>
          )}

          <button className="btn btn--ghost" onClick={() => setScreen('menu')}>
            {t('hub.back')}
          </button>
        </div>
      </div>
    </div>
  );
}
