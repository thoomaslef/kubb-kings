import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { bridge } from '../game/GameBridge';
import { AI_PROFILES, type Difficulty } from '../game/ai';
import { BATONS, BATON_IDS } from '../game/batons';
import { levelFromXp } from '../game/progression';
import { KUBB_SKINS, KING_SKINS } from '../game/theme';
import { THROW_EFFECT_IDS } from '../game/throwEffects';
import { isShopRefOwned, SHOP_ITEMS, type ShopCategory } from '../game/shop';
import { LADDER, getBestStage } from '../game/roguelite';
import { useT } from '../i18n/useT';
import { RankBadge, useRankName } from './RankBadge';
import { accountAvailable } from '../game/account/sync';
import type { Lang } from '../i18n/translate';

const LEVELS = Object.keys(AI_PROFILES) as Difficulty[];
const LANGS: Lang[] = ['fr', 'en'];
const LANG_AUTONYM: Record<Lang, string> = { fr: 'Français', en: 'English' };

/** "★★★☆☆" pour n etoiles sur 5. */
function stars(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
}

export function Menu() {
  const t = useT();
  const setScreen = useGameStore((s) => s.setScreen);
  const rank = useGameStore((s) => s.rank);
  const account = useGameStore((s) => s.account);
  const lastRankChange = useGameStore((s) => s.lastRankChange);
  const clearRankChange = useGameStore((s) => s.clearRankChange);
  const rankName = useRankName();
  const difficulty = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const kubbSkin = useGameStore((s) => s.kubbSkin);
  const setKubbSkin = useGameStore((s) => s.setKubbSkin);
  const kingSkin = useGameStore((s) => s.kingSkin);
  const setKingSkin = useGameStore((s) => s.setKingSkin);
  const batonId = useGameStore((s) => s.batonId);
  const setBatonId = useGameStore((s) => s.setBatonId);
  const windEnabled = useGameStore((s) => s.windEnabled);
  const setWindEnabled = useGameStore((s) => s.setWindEnabled);
  const fieldKubbsEnabled = useGameStore((s) => s.fieldKubbsEnabled);
  const setFieldKubbsEnabled = useGameStore((s) => s.setFieldKubbsEnabled);
  const lang = useGameStore((s) => s.lang);
  const setLang = useGameStore((s) => s.setLang);
  const setMode = useGameStore((s) => s.setMode);
  const openMapSelect = useGameStore((s) => s.openMapSelect);
  const online = useGameStore((s) => s.online);
  const endOnline = useGameStore((s) => s.endOnline);
  const startRun = useGameStore((s) => s.startRun);
  const progression = useGameStore((s) => s.progression);
  const levelInfo = levelFromXp(progression.totalXp);
  const coins = useGameStore((s) => s.coins);
  const ownedItems = useGameStore((s) => s.ownedItems);
  const trailEffect = useGameStore((s) => s.trailEffect);
  const setTrailEffect = useGameStore((s) => s.setTrailEffect);

  const level = levelInfo.level;

  const availableSkins = KUBB_SKINS.filter((skin) => isShopRefOwned('skin', skin, ownedItems));
  const availableKingSkins = KING_SKINS.filter((skin) => isShopRefOwned('king', skin, ownedItems));
  const availableBatons = BATON_IDS.filter((id) => isShopRefOwned('baton', id, ownedItems));
  const availableEffects = THROW_EFFECT_IDS.filter((id) => isShopRefOwned('trail', id, ownedItems));

  // Prochain article de boutique a venir dans cette categorie, pour motiver
  // la progression (le niveau ouvre juste le DROIT d'acheter, cf. shop.ts) —
  // undefined une fois tout debloque dans cette categorie.
  const nextInCategory = (category: ShopCategory) =>
    SHOP_ITEMS.filter((it) => it.category === category && it.minLevel > level).sort((a, b) => a.minLevel - b.minLevel)[0];
  const nextBaton = nextInCategory('baton');

  // Lue une seule fois au montage : elle ne peut changer que pendant une run,
  // ecran que ce composant n'affiche jamais.
  const [bestStage] = useState(getBestStage);

  // Le terrain se choisit maintenant sur son propre ecran, juste avant la
  // partie (cf. MapSelect.tsx) : le menu n'enchaine plus directement.
  const play = (mode: 'solo' | 'local' | '2v2') => openMapSelect(mode);

  const playDefi = () => {
    setMode('defi');
    startRun();
    bridge.send('start-match');
  };

  // Une partie en ligne qui s'arrete seule (adversaire parti, liaison
  // coupee) ramenait au menu sans un mot : le joueur ne pouvait que deviner.
  if (online && online.status === 'terminee' && online.endedBecause) {
    return (
      <div className="overlay overlay--solid">
        <div className="panel">
          <h2 className="panel__title">{t('online.endedTitle')}</h2>
          <p className="panel__text">{t(`online.ended.${online.endedBecause}`)}</p>
          <div className="button-column">
            <button className="btn" onClick={endOnline}>
              {t('online.back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay overlay--solid">
      <div className="panel panel--menu">
        <h1 className="title">
          KUBB<span className="title__accent">: Kings</span>
        </h1>
        <p className="subtitle">{t('menu.subtitle')}</p>

        {/* Sans service configure (build local, tests), pas de compte a proposer. */}
        {accountAvailable() && (
          <button type="button" className="btn btn--ghost btn--account" onClick={() => setScreen('account')}>
            {account.status === 'signedIn' && account.email
              ? t('menu.account.signedIn', { email: account.email })
              : t('menu.account.signedOut')}
          </button>
        )}

        {/* Un mouvement de rang hors fin de partie normale (forfait, onglet ferme) : annonce, une fois. */}
        {lastRankChange && lastRankChange.reason !== 'match' && (
          <button type="button" className="footnote ranks-change" onClick={clearRankChange}>
            {t(`ranks.change.${lastRankChange.reason}`, {
              from: rankName(lastRankChange.before),
              to: rankName(lastRankChange.after)
            })}
          </button>
        )}

        <button
          type="button"
          className="xp-panel xp-panel--compact xp-panel--clickable"
          onClick={() => setScreen('progression')}
          aria-label={t('menu.progressionAria')}
        >
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
        </button>

        <div className="button-column">
          <button className="btn btn--primary" onClick={() => play('solo')}>
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

          <button className="btn" onClick={() => play('local')}>
            {t('menu.local1v1')}
          </button>
          <button className="btn" onClick={() => play('2v2')}>
            {t('menu.local2v2')}
          </button>
          <button className="btn" onClick={playDefi}>
            {t('menu.defi', { n: LADDER.length })}
          </button>
          <button className="btn" onClick={() => openMapSelect('tournament')}>
            {t('menu.tournament')}
          </button>
          <button className="btn" onClick={() => openMapSelect('online')}>
            {t('menu.online')}
          </button>
          <button className="btn btn--ranked" onClick={() => setScreen('ranks')}>
            <RankBadge index={rank.index} size="sm" />
            {t('menu.ranked', { rank: rankName(rank.index) })}
          </button>
          {bestStage > 0 && (
            <p className="footnote footnote--tight">
              {t(bestStage > 1 ? 'menu.bestStage.many' : 'menu.bestStage.one', {
                stage: bestStage,
                total: LADDER.length
              })}
            </p>
          )}

          <p className="segmented-label">{t('menu.windAria')}</p>
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

          <p className="segmented-label">{t('menu.fieldKubbsAria')}</p>
          <div className="segmented" role="group" aria-label={t('menu.fieldKubbsAria')}>
            <button
              className={`segmented__item${!fieldKubbsEnabled ? ' segmented__item--on' : ''}`}
              aria-pressed={!fieldKubbsEnabled}
              onClick={() => setFieldKubbsEnabled(false)}
            >
              {t('menu.fieldKubbsOff')}
            </button>
            <button
              className={`segmented__item${fieldKubbsEnabled ? ' segmented__item--on' : ''}`}
              aria-pressed={fieldKubbsEnabled}
              onClick={() => setFieldKubbsEnabled(true)}
            >
              {t('menu.fieldKubbsOn')}
            </button>
          </div>
          <p className="footnote footnote--tight">
            {t(fieldKubbsEnabled ? 'menu.fieldKubbsOnHint' : 'menu.fieldKubbsOffHint')}
          </p>

          <p className="segmented-label">{t('menu.skinAria')}</p>
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

          <p className="segmented-label">{t('menu.kingSkinAria')}</p>
          <div className="segmented" role="group" aria-label={t('menu.kingSkinAria')}>
            {availableKingSkins.map((skin) => (
              <button
                key={skin}
                className={`segmented__item${skin === kingSkin ? ' segmented__item--on' : ''}`}
                aria-pressed={skin === kingSkin}
                onClick={() => setKingSkin(skin)}
              >
                {t(`king.${skin}.label`)}
              </button>
            ))}
          </div>
          <p className="footnote footnote--tight">{t(`king.${kingSkin}.hint`)}</p>

          <p className="segmented-label">{t('menu.batonAria')}</p>
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
          {nextBaton && (
            <p className="footnote footnote--tight footnote--locked">
              {t('menu.nextBatonUnlock', { name: t(`baton.${nextBaton.refId}.label`), level: nextBaton.minLevel })}
            </p>
          )}

          <p className="segmented-label">{t('menu.effectAria')}</p>
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
          <button className="btn" onClick={() => setScreen('achievements')}>
            {t('menu.achievements')}
          </button>

          <p className="segmented-label">{t('menu.langAria')}</p>
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
