/**
 * Terrains sur lesquels le joueur a deja gagne au moins une fois, pour le
 * succes "Collectionneur" — sur le meme modele que achievementsPersistence.ts.
 *
 * Premier etat de succes CUMULATIF du jeu : les autres succes se jouent
 * entierement dans une seule partie, celui-ci se construit d'une partie a
 * l'autre et a donc besoin de sa propre trace persistee.
 */
const KEY = 'kubb-kings.terrain-wins';

export function loadTerrainWins(): string[] {
  try {
    const raw = window.localStorage?.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveTerrainWins(ids: readonly string[]) {
  try {
    window.localStorage?.setItem(KEY, JSON.stringify(ids));
  } catch {
    // La collection ne survivra pas au rechargement, sans consequence sur le jeu.
  }
}
