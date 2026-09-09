import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { bridge } from '../game/GameBridge';
import { AI_PROFILES, type Difficulty } from '../game/ai';
import { FIELD_PRESETS, type FieldPresetId } from '../game/rules';
import { KUBB_SKINS } from '../game/theme';
import { LADDER, getBestStage } from '../game/roguelite';
import { useT } from '../i18n/useT';
import type { Lang } from '../i18n/translate';

const LEVELS = Object.keys(AI_PROFILES) as Difficulty[];
const PRESETS = Object.keys(FIELD_PRESETS) as FieldPresetId[];
const LANGS: Lang[] = ['fr', 'en'];
const LANG_AUTONYM: Record<Lang, string> = { fr: 'Français', en: 'English' };

export function Menu() {
  const t = useT();
  const setScreen = useGameStore((s) => s.setScreen);
  const difficulty = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const fieldPreset = useGameStore((s) => s.fieldPreset);
  const setFieldPreset = useGameStore((s) => s.setFieldPreset);
  const kubbSkin = useGameStore((s) => s.kubbSkin);
  const setKubbSkin = useGameStore((s) => s.setKubbSkin);
  const windEnabled = useGameStore((s) => s.windEnabled);
  const setWindEnabled = useGameStore((s) => s.setWindEnabled);
  const lang = useGameStore((s) => s.lang);
  const setLang = useGameStore((s) => s.setLang);
  const setMode = useGameStore((s) => s.setMode);
  const startRun = useGameStore((s) => s.startRun);

  // Lue une seule fois au montage : elle ne peut changer que pendant une run,
  // ecran que ce composant n'affiche jamais.
  const [bestStage] = useState(getBestStage);

  const play = (mode: 'solo' | 'local' | '2v2') => {
    setMode(mode);
    bridge.send('start-match');
  };

  const playDefi = () => {
    setMode('defi');
    startRun();
    bridge.send('start-match');
  };

  return (
    <div className="overlay overlay--solid">
      <div className="panel panel--menu">
        <h1 className="title">
          KUBB<span className="title__accent">: Kings</span>
        </h1>
        <p className="subtitle">{t('menu.subtitle')}</p>

        <div className="button-column">
          <button className="btn btn--primary" onClick={() => play('solo')}>
            {t('menu.solo')}
          </button>

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

          <button className="btn" onClick={() => play('local')}>
            {t('menu.local1v1')}
          </button>
          <button className="btn" onClick={() => play('2v2')}>
            {t('menu.local2v2')}
          </button>
          <button className="btn" onClick={playDefi}>
            {t('menu.defi', { n: LADDER.length })}
          </button>
          <button className="btn" onClick={() => setScreen('tournament-setup')}>
            {t('menu.tournament')}
          </button>
          {bestStage > 0 && (
            <p className="footnote footnote--tight">
              {t(bestStage > 1 ? 'menu.bestStage.many' : 'menu.bestStage.one', {
                stage: bestStage,
                total: LADDER.length
              })}
            </p>
          )}

          <div className="segmented" role="group" aria-label={t('menu.terrainAria')}>
            {PRESETS.map((id) => (
              <button
                key={id}
                className={`segmented__item${id === fieldPreset ? ' segmented__item--on' : ''}`}
                aria-pressed={id === fieldPreset}
                onClick={() => setFieldPreset(id)}
              >
                {t(`terrain.${id}.label`)}
              </button>
            ))}
          </div>
          <p className="footnote footnote--tight">{t(`terrain.${fieldPreset}.hint`)}</p>

          <div className="segmented" role="group" aria-label={t('menu.windAria')}>
            <button
              className={`segmented__item${!windEnabled ? ' segmented__item--on' : ''}`}
              aria-pressed={!windEnabled}
              onClick={() => setWindEnabled(false)}
            >
              {t('menu.windOff')}
            </button>
            <button
              className={`segmented__item${windEnabled ? ' segmented__item--on' : ''}`}
              aria-pressed={windEnabled}
              onClick={() => setWindEnabled(true)}
            >
              {t('menu.windOn')}
            </button>
          </div>
          <p className="footnote footnote--tight">{t(windEnabled ? 'menu.windOnHint' : 'menu.windOffHint')}</p>

          <div className="segmented" role="group" aria-label={t('menu.skinAria')}>
            {KUBB_SKINS.map((skin) => (
              <button
                key={skin}
                className={`segmented__item${skin === kubbSkin ? ' segmented__item--on' : ''}`}
                aria-pressed={skin === kubbSkin}
                onClick={() => setKubbSkin(skin)}
              >
                {t(`skin.${skin}.label`)}
              </button>
            ))}
          </div>
          <p className="footnote footnote--tight">{t(`skin.${kubbSkin}.hint`)}</p>

          <div className="segmented" role="group" aria-label={t('menu.langAria')}>
            {LANGS.map((code) => (
              <button
                key={code}
                className={`segmented__item${code === lang ? ' segmented__item--on' : ''}`}
                aria-pressed={code === lang}
                onClick={() => setLang(code)}
              >
                {LANG_AUTONYM[code]}
              </button>
            ))}
          </div>

          <button className="btn" onClick={() => setScreen('rules')}>
            {t('menu.rules')}
          </button>
          <button className="btn btn--ghost" onClick={() => setScreen('quit')}>
            {t('menu.quit')}
          </button>
        </div>

        <p className="footnote">{t('menu.footer')}</p>
        <button className="link-btn" onClick={() => setScreen('about')}>
          {t('menu.about')}
        </button>
        <button className="link-btn" onClick={() => setScreen('legal')}>
          {t('menu.legal')}
        </button>
      </div>
    </div>
  );
}
