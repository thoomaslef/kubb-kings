/**
 * Rangs des parties classees : six paliers de trois divisions.
 *
 * Bronze < Argent < Or < Platine < Diamant < Master, chacun en divisions 1, 2
 * et 3 — la division 3 est la PLUS HAUTE d'un palier (Or 2 + une victoire =
 * Or 3 ; Or 3 + une victoire = Platine 1). Dix-huit marches en tout.
 *
 * Regle : une victoire monte d'une marche, une defaite descend d'une marche.
 * Un match nul ne change rien. On ne descend pas sous Bronze 1 et l'on ne
 * monte pas au-dela de Master 3. Volontairement SANS points de ligue : c'est
 * la regle demandee, et elle se lit d'un coup d'oeil. Son prix est connu — un
 * joueur de niveau moyen oscille autour de son niveau reel, et la marche ne
 * dit pas « a quel point » on a gagne.
 *
 * Module pur, comme ai.ts et roguelite.ts : aucun acces au store ni au
 * stockage. Le rang est LOCAL a l'appareil (cf. rankPersistence.ts) : aucun
 * serveur n'arbitre, il n'y a donc pas de classement mondial.
 */

export type RankTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master';

/** Du plus bas au plus haut. Libelles : src/i18n/dictionaries.ts (rank.tier.<id>). */
export const RANK_TIERS: readonly RankTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'];
export const DIVISIONS_PER_TIER = 3;
/** Nombre de marches : 6 paliers x 3 divisions. */
export const RANK_COUNT = RANK_TIERS.length * DIVISIONS_PER_TIER;

/** Couleur de chaque palier, pour l'insigne et l'echelle. */
export const RANK_COLORS: Record<RankTier, string> = {
  bronze: '#c08457',
  silver: '#b8c4cc',
  gold: '#f2c14e',
  platinum: '#6fd6c8',
  diamond: '#5ad1ff',
  master: '#d77bff'
};

export interface RankPosition {
  tier: RankTier;
  /** 1 (la plus basse) a 3 (la plus haute) au sein du palier. */
  division: number;
}

/** Marche (0 = Bronze 1 ... 17 = Master 3) -> palier et division. */
export function rankPosition(index: number): RankPosition {
  const i = clampRank(index);
  return {
    tier: RANK_TIERS[Math.floor(i / DIVISIONS_PER_TIER)],
    division: (i % DIVISIONS_PER_TIER) + 1
  };
}

export function rankIndex(tier: RankTier, division: number): number {
  return clampRank(RANK_TIERS.indexOf(tier) * DIVISIONS_PER_TIER + (division - 1));
}

export function clampRank(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(RANK_COUNT - 1, Math.floor(index)));
}

export type RankedOutcome = 'win' | 'loss' | 'draw';

/** Etat conserve d'un joueur : sa marche, son bilan, et son meilleur rang atteint. */
export interface RankState {
  index: number;
  wins: number;
  losses: number;
  /** Marche la plus haute jamais atteinte. */
  peak: number;
}

export function initialRankState(): RankState {
  return { index: 0, wins: 0, losses: 0, peak: 0 };
}

/** Marche apres un resultat : +1 sur une victoire, -1 sur une defaite, bornee. */
export function stepAfter(index: number, outcome: RankedOutcome): number {
  if (outcome === 'win') return clampRank(index + 1);
  if (outcome === 'loss') return clampRank(index - 1);
  return clampRank(index);
}

export function applyRankedResult(state: RankState, outcome: RankedOutcome): RankState {
  const index = stepAfter(state.index, outcome);
  return {
    index,
    wins: state.wins + (outcome === 'win' ? 1 : 0),
    losses: state.losses + (outcome === 'loss' ? 1 : 0),
    peak: Math.max(state.peak, index)
  };
}

/** Le palier change-t-il entre deux marches ? (promotion ou relegation de palier) */
export function changesTier(before: number, after: number): boolean {
  return rankPosition(before).tier !== rankPosition(after).tier;
}

/** Cle de traduction du palier, et chiffre de la division. */
export const rankTierKey = (tier: RankTier) => `rank.tier.${tier}`;
