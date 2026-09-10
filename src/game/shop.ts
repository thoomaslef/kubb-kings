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
 */

export type ShopCategory = 'skin' | 'trail' | 'baton';

export interface ShopItem {
  id: string;
  category: ShopCategory;
  /** Cle vers KubbSkin, ThrowEffectId ou BatonId selon la categorie. */
  refId: string;
  price: number;
}

export const SHOP_ITEMS: readonly ShopItem[] = [
  { id: 'skin-ardoise', category: 'skin', refId: 'ardoise', price: 300 },
  { id: 'trail-feu', category: 'trail', refId: 'feu', price: 150 },
  { id: 'trail-glace', category: 'trail', refId: 'glace', price: 150 },
  { id: 'baton-stabilise', category: 'baton', refId: 'stabilise', price: 500 }
];

/**
 * Vrai si ce refId (un KubbSkin, ThrowEffectId ou BatonId) est utilisable au
 * menu : soit il ne correspond a aucun article de boutique (disponible
 * d'office), soit son article a ete achete. Utilise pour filtrer les
 * selecteurs du menu aux seuls choix debloques.
 */
export function isShopRefOwned(category: ShopCategory, refId: string, ownedItems: readonly string[]): boolean {
  const item = SHOP_ITEMS.find((it) => it.category === category && it.refId === refId);
  return !item || ownedItems.includes(item.id);
}
