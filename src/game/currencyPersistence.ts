import { INITIAL_CURRENCY, type CurrencyState } from './currency';

/** Persistance des pieces, sur le meme modele que progressionPersistence.ts. */
const KEY = 'kubb-kings.currency';

export function loadCurrency(): CurrencyState {
  try {
    const raw = window.localStorage?.getItem(KEY);
    if (!raw) return INITIAL_CURRENCY;
    const parsed = JSON.parse(raw) as Partial<CurrencyState>;
    const coins = Number(parsed.coins);
    return Number.isFinite(coins) && coins >= 0 ? { coins } : INITIAL_CURRENCY;
  } catch {
    return INITIAL_CURRENCY;
  }
}

export function saveCurrency(state: CurrencyState) {
  try {
    window.localStorage?.setItem(KEY, JSON.stringify(state));
  } catch {
    // Les pieces ne survivront pas au rechargement, sans consequence sur le jeu.
  }
}
