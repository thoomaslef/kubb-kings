import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { bridge } from '../game/GameBridge';
import { AI_PROFILES, type Difficulty } from '../game/ai';
import { FIELD_PRESETS, type FieldPresetId } from '../game/rules';
import { BATONS, BATON_IDS } from '../game/batons';
import { levelFromXp } from '../game/progression';
import { KUBB_SKINS } from '../game/theme';
import { THROW_EFFECT_IDS } from '../game/throwEffects';
import { isShopRefOwned } from '../game/shop';
import { LADDER, getBestStage } from '../game/roguelite';
import { useT } from '../i18n/useT';
import type { Lang } from '../i18n/translate';

const LEVELS = Object.keys(AI_PROFILES) as Difficulty[];
const PRESETS = Object.keys(FIELD_PRESETS) as FieldPresetId[];
const LANGS: Lang[] = ['fr', 'en'];
const LANG_AUTONYM: Record<Lang, string> = { fr: 'Français', en: 'English' };

/** "★★★☆☆" pour n etoiles sur 5. */
function stars(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
}

export function Menu() {
  const t = useT();
  const setScreen = useGameStore((s) => s.setScreen);
  const difficulty = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const fieldPreset = useGameStore((s) => s.fieldPreset);
  const setFieldPreset = useGameStore((s) => s.setFieldPreset);
  const kubbSkin = useGameStore((s) => s.kubbSkin);
  const setKubbSkin = useGameStore((s) => s.setKubbSkin);
  const batonId = useGameStore((s) => s.batonId);
  const setBatonId = useGameStore((s) => s.setBatonId);
  const windEnabled = useGameStore((s) => s.windEnabled);
  const setWindEnabled = useGameStore((s) => s.setWindEnabled);
  const lang = useGameStore((s) => s.lang);
  const setLang = useGameStore((s) => s.setLang);
  const setMode = useGameStore((s) => s.setMode);
  const startRun = useGameStore((s) => s.startRun);
  const progression = useGameStore((s) => s.progression);
  const levelInfo = levelFromXp(progression.totalXp);
  const coins = useGameStore((s) => s.coins);
  const ownedItems = useGameStore((s) => s.ownedItems);
  const trailEffect = useGameStore((s) => s.trailEffect);
  const setTrailEffect = useGameStore((s) => s.setTrailEffect);

  const availableSkins = KUBB_SKINS.filter((skin) => isShopRefOwned('skin', skin, ownedItems));
  const availableBatons = BATON_IDS.filter((id) => isShopRefOwned('baton', id, ownedItems));
  const availableEffects = THROW_EFFECT_IDS.filter((id) => isShopRefOwned('trail', id, ownedItems));

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

        <div className="xp-panel xp-panel--compact">
          <div className="xp-panel__header">
            <span className="xp-panel__icon">{levelInfo.icon}</span>
            <span className="xp-panel__level">{t('progression.level', { n: levelInfo.level })}</span>
            <span className="xp-panel__title">{t(levelInfo.titleKey)}</span>
          </div>
          <div className="xp-panel__bar-track">
            <div
              className="xp-panel__bar-fill"
              style={{ width: `${Math.min(100, (levelInfo.xpIntoLevel / levelInfo.xpForThisLevel) * 100)}%` }}
            />
          </div>
          <p className="xp-panel__bar-label">
            {levelInfo.xpIntoLevel} / {levelInfo.xpForThisLevel} XP
          </p>
        </div>

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
            {availableSkins.map((skin) => (
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

          <div className="segmented" role="group" aria-label={t('menu.batonAria')}>
            {availableBatons.map((id) => (
              <button
                key={id}
                className={`segmented__item${id === batonId ? ' segmented__item--on' : ''}`}
                aria-pressed={id === batonId}
                onClick={() => setBatonId(id)}
              >
                {t(`baton.${id}.label`)}
              </button>
            ))}
          </div>
          <p className="footnote footnote--tight">
            {t('baton.statPower')} {stars(BATONS[batonId].power)} · {t('baton.statPrecision')}{' '}
            {stars(BATONS[batonId].precision)} · {t('baton.statControl')} {stars(BATONS[batonId].control)}
          </p>

          <div className="segmented" role="group" aria-label={t('menu.effectAria')}>
            {availableEffects.map((id) => (
              <button
                key={id}
                className={`segmented__item${id === trailEffect ? ' segmented__item--on' : ''}`}
                aria-pressed={id === trailEffect}
                onClick={() => setTrailEffect(id)}
              >
                {t(`effect.${id}.label`)}
              </button>
            ))}
          </div>
          <p className="footnote footnote--tight">{t(`effect.${trailEffect}.hint`)}</p>

          <button className="btn" onClick={() => setScreen('shop')}>
            {t('menu.shop')} — {t('menu.coinsAria', { n: coins })}
          </button>

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
