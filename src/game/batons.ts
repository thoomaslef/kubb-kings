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
 * L'IA n'utilise jamais ces multiplicateurs (toujours le baton de base) :
 * ce choix ne touche donc a aucun des reglages de securite de l'IA.
 */

/**
 * 'stabilise' est un baton de boutique (src/game/shop.ts) : verrouille tant
 * qu'il n'a pas ete achete. Les 4 autres restent disponibles d'office.
 */
export type BatonId = 'base' | 'nordique' | 'sniper' | 'lourd' | 'stabilise';

export const BATON_IDS: readonly BatonId[] = ['base', 'nordique', 'sniper', 'lourd', 'stabilise'];

/** Batons disponibles d'office, sans passer par la boutique. */
export const FREE_BATON_IDS: readonly BatonId[] = ['base', 'nordique', 'sniper', 'lourd'];

export interface BatonStats {
  /** Etoiles 1-5 (3 = baseline), purement pour le calcul des multiplicateurs et l'affichage menu. */
  power: number;
  precision: number;
  control: number;
}

export const BATONS: Record<BatonId, BatonStats> = {
  base: { power: 3, precision: 3, control: 3 },
  nordique: { power: 4, precision: 2, control: 3 },
  sniper: { power: 2, precision: 5, control: 3 },
  lourd: { power: 5, precision: 2, control: 3 },
  // Seul baton a vraiment jouer sur le Controle (les 4 autres restent tous a
  // 3) : un compromis different, pas un strict progres — baseline ailleurs.
  stabilise: { power: 3, precision: 3, control: 5 }
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
