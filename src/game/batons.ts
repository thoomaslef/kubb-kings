/**
 * Batons : equipement du joueur (jamais de l'IA, qui reste toujours sur le
 * baton de base), choisi librement au menu comme un skin — sauf qu'ici le
 * choix a un vrai effet de jeu, une progression de style plutot que de
 * puissance pure (chaque baton est un compromis, pas un strict progres).
 *
 * 3 stats affichees en etoiles (1 a 5, 3 = le baton de base) :
 * - Puissance : vitesse max du baton (+/-6% par etoile).
 * - Precision : deviation aleatoire du lancer (+/-18% par etoile, MOINS de
 *   deviation pour PLUS d'etoiles).
 * - Controle : resistance au vent (+/-15% par etoile, MOINS d'effet du vent
 *   pour PLUS d'etoiles) — donne un vrai enjeu strategique au vent.
 *
 * Un baton a aussi une forme (`shape`) : 'baton' (le rectangle allonge par
 * defaut) ou 'boule' (un corps Matter circulaire, cf. HITBOX.ballRadius dans
 * rules.ts et Baton.ts) — purement une question de corps physique/texture,
 * les memes multiplicateurs de stats s'appliquent quelle que soit la forme.
 *
 * L'IA n'utilise jamais ces multiplicateurs ni cette forme (toujours le
 * baton de base) : ce choix ne touche donc a aucun des reglages de securite
 * de l'IA.
 */

/**
 * Tous les batons hors "base" sont des articles de boutique (src/game/shop.ts,
 * SHOP_ITEMS) : verrouilles tant qu'ils n'ont pas ete achetes (et que
 * ShopItem.minLevel n'est pas atteint). Seul "base" est disponible d'office.
 */
export type BatonId = 'base' | 'nordique' | 'sniper' | 'lourd' | 'stabilise' | 'boule';

export const BATON_IDS: readonly BatonId[] = ['base', 'nordique', 'sniper', 'lourd', 'stabilise', 'boule'];

/** Seul baton disponible d'office, sans passer par la boutique. */
export const FREE_BATON_IDS: readonly BatonId[] = ['base'];

export interface BatonStats {
  /** Etoiles 1-5 (3 = baseline), purement pour le calcul des multiplicateurs et l'affichage menu. */
  power: number;
  precision: number;
  control: number;
  /**
   * Forme du projectile : 'baton' (rectangle allonge, par defaut) ou
   * 'boule' (corps Matter circulaire, cf. HITBOX.ballRadius dans rules.ts
   * et Baton.ts). Purement une question de corps physique/texture — l'IA
   * n'a aucune notion de forme, elle reste toujours sur le baton de base.
   */
  shape: 'baton' | 'boule';
}

export const BATONS: Record<BatonId, BatonStats> = {
  base: { power: 3, precision: 3, control: 3, shape: 'baton' },
  nordique: { power: 4, precision: 2, control: 3, shape: 'baton' },
  sniper: { power: 2, precision: 5, control: 3, shape: 'baton' },
  lourd: { power: 5, precision: 2, control: 3, shape: 'baton' },
  // Seul baton a vraiment jouer sur le Controle (les 4 autres restent tous a
  // 3) : un compromis different, pas un strict progres — baseline ailleurs.
  stabilise: { power: 3, precision: 3, control: 5, shape: 'baton' },
  // Boule : roule droit (Precision haute) mais plus dure a doser sous le
  // vent, sans l'allonge du baton (Controle bas) — Puissance au baseline.
  boule: { power: 3, precision: 4, control: 2, shape: 'boule' }
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
