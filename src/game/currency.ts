/** Monnaie du joueur (Phase 3 de la progression), persistee (currencyPersistence.ts). */
export interface CurrencyState {
  coins: number;
}

export const INITIAL_CURRENCY: CurrencyState = { coins: 0 };

/**
 * Pieces gagnees a la fin d'un match, cote equipe Bleue (le profil, comme
 * l'XP — cf. progression.ts). Bareme simple : une base de participation, un
 * bonus par kubb adverse abattu, un bonus de victoire.
 */
export function computeCoinsAward(knockedDownByBlue: number, won: boolean): number {
  return 20 + knockedDownByBlue * 10 + (won ? 50 : 0);
}
