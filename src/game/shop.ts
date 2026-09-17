/**
 * Boutique : articles achetables avec les pieces gagnees en match (Phase 3
 * de la progression). Purement cosmetique/joueur — pareil que les batons
 * (src/game/batons.ts), aucun de ces choix n'atteint jamais l'IA.
 *
 * Seuls le terrain "Classique", le baton "De base", le skin de kubb "Bois"
 * et le skin de roi "Or" restent disponibles d'office (le strict minimum
 * pour jouer une premiere partie) — tout le reste (terrains, batons, skins
 * de kubb, skins de roi, effets de lancer) passe desormais par ce
 * catalogue : chaque article exige a la fois d'avoir assez
 * de pieces ET d'avoir atteint un niveau minimum (`minLevel`, cf.
 * progression.ts) — les deux conditions sont necessaires pour acheter
 * (useGameStore::purchaseItem). Un terrain de boutique n'a besoin d'aucune
 * verification IA supplementaire : c'est un reglage de partie choisi au
 * menu avant le match (comme la difficulte ou la meteo), jamais une
 * decision de l'IA elle-meme — seul son contenu (obstacles, friction,
 * cf. rules.ts::FIELD_PRESETS) compte pour `decideThrow`, pas la facon dont
 * le joueur y a accede.
 */

export type ShopCategory = 'skin' | 'trail' | 'baton' | 'terrain' | 'king';

export interface ShopItem {
  id: string;
  category: ShopCategory;
  /** Cle vers KubbSkin, ThrowEffectId, BatonId, FieldPresetId ou KingSkin selon la categorie. */
  refId: string;
  price: number;
  /**
   * Niveau du joueur (progression.ts::levelFromXp) requis pour ACHETER cet
   * article — a distinguer de son prix : les deux conditions sont
   * necessaires (avoir assez de pieces ET avoir atteint ce niveau), cf.
   * useGameStore::purchaseItem. Une fois achete, reste possede quel que soit
   * le niveau ensuite (pas de niveau qui redescend).
   */
  minLevel: number;
}

// Niveaux choisis pour ne jamais tomber sur un palier de titre (progression.ts
// LEVEL_TITLES : 1/5/10/16/24/32) ni sur un autre article — l'ecran
// Progression (Progression.tsx) affiche donc toujours exactement un seul
// deblocage par niveau.
export const SHOP_ITEMS: readonly ShopItem[] = [
  { id: 'terrain-chicane', category: 'terrain', refId: 'chicane', price: 150, minLevel: 2 },
  { id: 'baton-nordique', category: 'baton', refId: 'nordique', price: 100, minLevel: 3 },
  { id: 'trail-glace', category: 'trail', refId: 'glace', price: 150, minLevel: 4 },
  { id: 'terrain-sentinelle', category: 'terrain', refId: 'sentinelle', price: 200, minLevel: 6 },
  { id: 'baton-sniper', category: 'baton', refId: 'sniper', price: 150, minLevel: 7 },
  { id: 'trail-feu', category: 'trail', refId: 'feu', price: 150, minLevel: 8 },
  { id: 'terrain-colline', category: 'terrain', refId: 'colline', price: 300, minLevel: 9 },
  { id: 'baton-lourd', category: 'baton', refId: 'lourd', price: 200, minLevel: 11 },
  { id: 'skin-ardoise', category: 'skin', refId: 'ardoise', price: 300, minLevel: 12 },
  { id: 'terrain-glace', category: 'terrain', refId: 'glace', price: 400, minLevel: 13 },
  { id: 'baton-boule', category: 'baton', refId: 'boule', price: 400, minLevel: 14 },
  { id: 'terrain-sable', category: 'terrain', refId: 'sable', price: 450, minLevel: 15 },
  { id: 'baton-stabilise', category: 'baton', refId: 'stabilise', price: 500, minLevel: 17 },
  { id: 'skin-marbre', category: 'skin', refId: 'marbre', price: 150, minLevel: 18 },
  { id: 'skin-metal', category: 'skin', refId: 'metal', price: 200, minLevel: 19 },
  { id: 'baton-boulefer', category: 'baton', refId: 'boulefer', price: 550, minLevel: 20 },
  { id: 'king-argent', category: 'king', refId: 'argent', price: 250, minLevel: 21 },
  { id: 'king-obsidienne', category: 'king', refId: 'obsidienne', price: 350, minLevel: 22 },
  { id: 'baton-disque', category: 'baton', refId: 'disque', price: 600, minLevel: 23 },
  { id: 'baton-plume', category: 'baton', refId: 'plume', price: 650, minLevel: 25 },
  { id: 'terrain-nuit', category: 'terrain', refId: 'nuit', price: 200, minLevel: 26 },
  { id: 'baton-enclume', category: 'baton', refId: 'enclume', price: 700, minLevel: 27 },
  { id: 'terrain-ruines', category: 'terrain', refId: 'ruines', price: 500, minLevel: 28 },
  { id: 'baton-fouet', category: 'baton', refId: 'fouet', price: 750, minLevel: 29 },
  { id: 'terrain-verger', category: 'terrain', refId: 'verger', price: 550, minLevel: 30 },
  { id: 'terrain-boue', category: 'terrain', refId: 'boue', price: 500, minLevel: 31 }
];

/**
 * Vrai si ce refId (un KubbSkin, ThrowEffectId, BatonId, FieldPresetId ou
 * KingSkin) est utilisable au menu : soit il ne correspond a aucun article
 * de boutique (le "de base" gratuit de chaque categorie — 'classique',
 * 'base', 'bois', 'or', 'none' — n'a jamais d'entree ici), soit son article
 * a ete achete.
 * Utilise pour filtrer les selecteurs du menu aux seuls choix debloques. Ne
 * verifie PAS le niveau (cf. isShopItemLevelUnlocked) : un article achete
 * reste utilisable quel que soit le niveau ensuite.
 */
export function isShopRefOwned(category: ShopCategory, refId: string, ownedItems: readonly string[]): boolean {
  const item = SHOP_ITEMS.find((it) => it.category === category && it.refId === refId);
  return !item || ownedItems.includes(item.id);
}

/** Vrai si le niveau du joueur suffit pour ACHETER cet article (independant du prix/solde). */
export function isShopItemLevelUnlocked(item: ShopItem, level: number): boolean {
  return level >= item.minLevel;
}
