import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { levelFromXp, LEVEL_TITLES } from '../game/progression';
import { BATON_MIN_LEVEL } from '../game/batons';
import { FIELD_PRESET_MIN_LEVEL } from '../game/rules';
import { SHOP_ITEMS, type ShopItem } from '../game/shop';
import { ACHIEVEMENTS } from '../game/achievements';
import { LADDER, getBestStage } from '../game/roguelite';
import { useT } from '../i18n/useT';

/** Cle i18n du libelle d'un article de boutique — meme regle que Shop.tsx. */
function shopLabelKey(item: ShopItem): string {
  const ns = item.category === 'trail' ? 'effect' : item.category;
  return `${ns}.${item.refId}.label`;
}

interface RoadmapEntry {
  level: number;
  /** Deja traduit : le nom de l'equipement + sa categorie entre parentheses. */
  text: string;
}

/**
 * Ecran "Progression" : le detail derriere le badge compact du menu — chaque
 * palier de niveau (batons.ts::BATON_MIN_LEVEL, rules.ts::FIELD_PRESET_MIN_LEVEL,
 * shop.ts::SHOP_ITEMS, et les titres cosmetiques de progression.ts) fusionne
 * en une seule feuille de route chronologique, plus quelques statistiques
 * deja disponibles ailleurs (menu, boutique, succes, Defi) mais jamais
 * reunies au meme endroit.
 */
export function Progression() {
  const t = useT();
  const setScreen = useGameStore((s) => s.setScreen);
  const progression = useGameStore((s) => s.progression);
  const coins = useGameStore((s) => s.coins);
  const ownedItems = useGameStore((s) => s.ownedItems);
  const unlockedAchievements = useGameStore((s) => s.unlockedAchievements);
  const levelInfo = levelFromXp(progression.totalXp);

  // Lue une seule fois au montage, comme dans Menu.tsx : ne peut changer que
  // pendant une run Defi, ecran que ce composant n'affiche jamais.
  const [bestStage] = useState(getBestStage);

  const batonLabel = t('menu.batonAria');
  const terrainLabel = t('menu.terrainAria');

  const entries: RoadmapEntry[] = [];
  entries.push({ level: 1, text: `${t('baton.base.label')} (${batonLabel})` });
  for (const [id, minLevel] of Object.entries(BATON_MIN_LEVEL)) {
    entries.push({ level: minLevel as number, text: `${t(`baton.${id}.label`)} (${batonLabel})` });
  }
  entries.push({ level: 1, text: `${t('terrain.classique.label')} (${terrainLabel})` });
  for (const [id, minLevel] of Object.entries(FIELD_PRESET_MIN_LEVEL)) {
    entries.push({ level: minLevel as number, text: `${t(`terrain.${id}.label`)} (${terrainLabel})` });
  }
  for (const item of SHOP_ITEMS) {
    const category = t(`shop.category.${item.category}`);
    entries.push({ level: item.minLevel, text: `${t(shopLabelKey(item))} (${category})` });
  }

  // Regroupe par niveau, en incluant les paliers de titre meme quand ils
  // n'ont aucun equipement associe (16/24/32) — une seule feuille de route.
  const levelSet = new Set<number>(entries.map((e) => e.level));
  for (const tier of LEVEL_TITLES) levelSet.add(tier.minLevel);
  const levels = [...levelSet].sort((a, b) => a - b);

  const achievementCount = ACHIEVEMENTS.length;
  const shopItemCount = SHOP_ITEMS.length;

  return (
    <div className="overlay overlay--solid">
      <div className="panel panel--scroll">
        <h2 className="panel__title">{t('progression.screenTitle')}</h2>
        <p className="panel__text">{t('progression.intro')}</p>

        <div className="xp-panel">
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
            {levelInfo.xpIntoLevel} / {levelInfo.xpForThisLevel} XP —{' '}
            {t('progression.xpToNext', { n: levelInfo.xpForThisLevel - levelInfo.xpIntoLevel, level: levelInfo.level + 1 })}
          </p>
          <p className="footnote footnote--tight">{t('progression.xpTotal', { n: progression.totalXp })}</p>
        </div>

        <h3 className="shop-section__title">{t('progression.statsTitle')}</h3>
        <ul className="stats-list">
          <li>{t('progression.stat.gamesPlayed', { n: progression.gamesPlayed })}</li>
          <li>{t('progression.stat.totalWins', { n: progression.totalWins })}</li>
          <li>{t('progression.stat.winStreak', { n: progression.winStreak })}</li>
          <li>
            {bestStage > 0
              ? t('progression.stat.bestStage', { stage: bestStage, total: LADDER.length })
              : t('progression.stat.bestStage.none')}
          </li>
          <li>{t('progression.stat.achievements', { n: unlockedAchievements.length, total: achievementCount })}</li>
          <li>{t('progression.stat.shopItems', { n: ownedItems.length, total: shopItemCount })}</li>
          <li>{t('menu.coinsAria', { n: coins })}</li>
        </ul>

        <h3 className="shop-section__title">{t('progression.roadmapTitle')}</h3>
        <div className="shop-list">
          {levels.map((level) => {
            const reached = levelInfo.level >= level;
            const items = entries.filter((e) => e.level === level);
            const tier = LEVEL_TITLES.find((tt) => tt.minLevel === level);
            return (
              <div key={level} className={`shop-item${reached ? ' shop-item--owned' : ''}`}>
                <div className="shop-item__body">
                  <span className="shop-item__label">{t('progression.level', { n: level })}</span>
                  {items.map((entry) => (
                    <span key={entry.text} className="shop-item__hint">
                      {entry.text}
                    </span>
                  ))}
                  {tier && (
                    <span className="shop-item__hint">
                      {t('progression.newTitle', { name: `${tier.icon} ${t(tier.titleKey)}` })}
                    </span>
                  )}
                </div>
                <div className="shop-item__footer">
                  {reached ? (
                    <span className="shop-item__owned">{t('progression.reached')}</span>
                  ) : (
                    <span className="shop-item__locked">{t('shop.requiresLevel', { level })}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="button-column" style={{ marginTop: 20 }}>
          <button className="btn btn--ghost" onClick={() => setScreen('menu')}>
            {t('progression.back')}
          </button>
        </div>
      </div>
    </div>
  );
}
