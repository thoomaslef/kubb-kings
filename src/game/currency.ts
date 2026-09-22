/** Monnaie du joueur (Phase 3 de la progression), persistee (currencyPersistence.ts). */
export interface CurrencyState {
  coins: number;
}

export const INITIAL_CURRENCY: CurrencyState = { coins: 0 };

/**
 * Pieces gagnees a la fin d'un match, cote equipe Bleue (le profil, comme
 * l'XP — cf. progression.ts). Bareme simple : une base de participation, un
 * bonus par kubb adverse abattu, un bonus de victoire, plus la somme des
 * Achievement.coins des succes nouvellement debloques ce match
 * (achievements.ts, deja calculee par MatchScene).
 * `multiplier` : bonus "Bourse pleine" (Defi, roguelite.ts), 1 hors Defi —
 * ne s'applique qu'au bareme de match, jamais aux succes.
 */
export function computeCoinsAward(knockedDownByBlue: number, won: boolean, achievementCoins = 0, multiplier = 1): number {
  return Math.round((20 + knockedDownByBlue * 10 + (won ? 50 : 0)) * multiplier) + achievementCoins;
}
