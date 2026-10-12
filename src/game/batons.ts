/**
 * Batons : skins du projectile du joueur (jamais de l'IA, qui reste toujours
 * sur le baton de base), choisis librement au menu comme les skins de kubb.
 *
 * PUREMENT COSMETIQUE : tous les batons ont exactement les memes stats
 * (3/3/3) et le meme corps physique (rectangle allonge) — meme vitesse, meme
 * deviation, meme prise au vent, meme friction. Un baton rare n'est jamais un
 * avantage, seulement un habillage (cf. BootScene::buildBatonSkins).
 *
 * Les multiplicateurs (`batonPowerMultiplier`...) et la forme (`shape`) sont
 * conserves : ils valent 1 / 'baton' pour tous aujourd'hui, mais gardent le
 * reste du moteur (MatchScene, Baton.ts) inchange et les identifiants
 * (donc les achats deja faits) valides.
 */

/**
 * Tous les batons hors "base" sont des articles de boutique (src/game/shop.ts,
 * SHOP_ITEMS) : verrouilles tant qu'ils n'ont pas ete achetes (et que
 * ShopItem.minLevel n'est pas atteint). Seul "base" est disponible d'office.
 */
export type BatonId =
  | 'base'
  | 'nordique'
  | 'sniper'
  | 'lourd'
  | 'stabilise'
  | 'boule'
  | 'boulefer'
  | 'disque'
  | 'plume'
  | 'enclume'
  | 'fouet';

export const BATON_IDS: readonly BatonId[] = [
  'base',
  'nordique',
  'sniper',
  'lourd',
  'stabilise',
  'boule',
  'boulefer',
  'disque',
  'plume',
  'enclume',
  'fouet'
];

/** Seul baton disponible d'office, sans passer par la boutique. */
export const FREE_BATON_IDS: readonly BatonId[] = ['base'];

export interface BatonStats {
  /** Etoiles 1-5 (3 = baseline), purement pour le calcul des multiplicateurs et l'affichage menu. */
  power: number;
  precision: number;
  control: number;
  /**
   * Forme du projectile : 'baton' (rectangle allonge, par defaut), 'boule'
   * ou 'disque' (deux corps Matter circulaires, cf. HITBOX.ballRadius /
   * discRadius dans rules.ts et Baton.ts). Purement une question de corps
   * physique — l'IA n'a aucune notion de forme, elle reste toujours sur le
   * baton de base.
   */
  shape: 'baton' | 'boule' | 'disque';
  /** Cle de texture (BootScene) — cf. docblock en tete de fichier. */
  textureKey: string;
}

/** Stats communes a tous les batons : aucun n'a d'avantage de jeu. */
const NEUTRE = { power: 3, precision: 3, control: 3, shape: 'baton' } as const;

export const BATONS: Record<BatonId, BatonStats> = {
  base: { ...NEUTRE, textureKey: 'baton' },
  nordique: { ...NEUTRE, textureKey: 'baton-nordique' },
  sniper: { ...NEUTRE, textureKey: 'baton-sniper' },
  lourd: { ...NEUTRE, textureKey: 'baton-lourd' },
  stabilise: { ...NEUTRE, textureKey: 'baton-stabilise' },
  boule: { ...NEUTRE, textureKey: 'baton-boule' },
  boulefer: { ...NEUTRE, textureKey: 'baton-boulefer' },
  disque: { ...NEUTRE, textureKey: 'baton-disque' },
  plume: { ...NEUTRE, textureKey: 'baton-plume' },
  enclume: { ...NEUTRE, textureKey: 'baton-enclume' },
  fouet: { ...NEUTRE, textureKey: 'baton-fouet' }
};

const STARS_BASELINE = 3;

/** Multiplicateur de vitesse max (Puissance) : 1.00 au baseline, +/-6% par etoile. */
export function batonPowerMultiplier(stats: BatonStats): number {
  return 1 + (stats.power - STARS_BASELINE) * 0.06;
}

/**
 * Deviation effective (Precision), a partir de la deviation de base du jeu
 * (MAX_AIM_DEVIATION_DEG) : +/-18% par etoile, MOINS de deviation pour PLUS
 * d'etoiles. Jamais negative (clampee a 0 au pire des cas).
 */
export function batonDeviationDeg(stats: BatonStats, baseDeviationDeg: number): number {
  return Math.max(0, baseDeviationDeg * (1 - (stats.precision - STARS_BASELINE) * 0.18));
}

/**
 * Multiplicateur d'acceleration du vent ressentie (Controle) : 1.00 au
 * baseline, MOINS d'effet du vent pour PLUS d'etoiles. Jamais negatif.
 */
export function batonWindMultiplier(stats: BatonStats): number {
  return Math.max(0, 1 - (stats.control - STARS_BASELINE) * 0.15);
}
