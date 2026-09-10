/**
 * Persistance des succes debloques (jamais perdus), sur le meme modele que
 * shopPersistence.ts.
 */
const KEY = 'kubb-kings.achievements.unlocked';

export function loadUnlockedAchievements(): string[] {
  try {
    const raw = window.localStorage?.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveUnlockedAchievements(ids: readonly string[]) {
  try {
    window.localStorage?.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Les succes ne survivront pas au rechargement, sans consequence sur le jeu.
  }
}
