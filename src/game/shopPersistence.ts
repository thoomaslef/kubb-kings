/**
 * Persistance des articles achetes (jamais perdus, contrairement aux
 * simples preferences de session comme le skin ou le vent). Sur le meme
 * modele que progressionPersistence.ts.
 */
const KEY = 'kubb-kings.shop.owned';

export function loadOwnedItems(): string[] {
  try {
    const raw = window.localStorage?.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveOwnedItems(ids: readonly string[]) {
  try {
    window.localStorage?.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Les achats ne survivront pas au rechargement, sans consequence sur le jeu.
  }
}
