/**
 * Boutique : articles achetables avec les pieces gagnees en match (Phase 3
 * de la progression). Purement cosmetique/joueur — pareil que les batons
 * (src/game/batons.ts), aucun de ces choix n'atteint jamais l'IA.
 *
 * Volontairement un petit catalogue de depart : chaque nouvel article visuel
 * (skin, roi...) demande un dessin procedural neuf (aucun asset externe
 * charge dans ce jeu, cf. BootScene) — un terrain neuf demanderait en plus
 * une verification IA complete (placement d'obstacles). Skins de kubbs,
 * effets de lancer et batons restent les categories les moins couteuses a
 * etendre ; rois et terrains ne sont pas encore au catalogue.
 *
 * Chaque article exige aussi un niveau minimum (`minLevel`, cf. progression.ts)
 * en plus de son prix — les deux conditions sont necessaires pour acheter
 * (useGameStore::purchaseItem). Meme logique de deblocage progressif que les
 * batons "gratuits" (batons.ts::BATON_MIN_LEVEL) et les terrains
 * (rules.ts::FIELD_PRESET_MIN_LEVEL), pour que l'XP/niveau serve enfin a
 * quelque chose au-dela du titre cosmetique du menu.
 */

export type ShopCategory = 'skin' | 'trail' | 'baton';

export interface ShopItem {
  id: string;
  category: ShopCategory;
  /** Cle vers KubbSkin, ThrowEffectId ou BatonId selon la categorie. */
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

export const SHOP_ITEMS: readonly ShopItem[] = [
  { id: 'trail-glace', category: 'trail', refId: 'glace', price: 150, minLevel: 4 },
  { id: 'trail-feu', category: 'trail', refId: 'feu', price: 150, minLevel: 8 },
  { id: 'skin-ardoise', category: 'skin', refId: 'ardoise', price: 300, minLevel: 12 },
  { id: 'baton-boule', category: 'baton', refId: 'boule', price: 400, minLevel: 14 },
  { id: 'baton-stabilise', category: 'baton', refId: 'stabilise', price: 500, minLevel: 17 }
];

/**
 * Vrai si ce refId (un KubbSkin, ThrowEffectId ou BatonId) est utilisable au
 * menu : soit il ne correspond a aucun article de boutique (disponible
 * d'office), soit son article a ete achete. Utilise pour filtrer les
 * selecteurs du menu aux seuls choix debloques. Ne verifie PAS le niveau
 * (cf. isShopItemPurchasable) : un article achete reste utilisable quel que
 * soit le niveau, et un article "gratuit" verrouille par niveau (batons.ts,
 * rules.ts) n'a jamais d'entree ici de toute facon.
 */
export function isShopRefOwned(category: ShopCategory, refId: string, ownedItems: readonly string[]): boolean {
  const item = SHOP_ITEMS.find((it) => it.category === category && it.refId === refId);
  return !item || ownedItems.includes(item.id);
}

/** Vrai si le niveau du joueur suffit pour ACHETER cet article (independant du prix/solde). */
export function isShopItemLevelUnlocked(item: ShopItem, level: number): boolean {
  return level >= item.minLevel;
}
