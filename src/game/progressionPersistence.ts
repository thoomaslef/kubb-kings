import { INITIAL_PROGRESSION, type ProgressionState } from './progression';

/**
 * Persistance de la progression, sur le meme modele que langPersistence.ts :
 * localStorage peut jeter (navigation privee, site data bloque), chaque
 * acces est donc protege — la progression repart simplement de zero plutot
 * que de planter le jeu.
 */
const KEY = 'kubb-kings.progression';

export function loadProgression(): ProgressionState {
  try {
    const raw = window.localStorage?.getItem(KEY);
    if (!raw) return INITIAL_PROGRESSION;
    const parsed = JSON.parse(raw) as Partial<ProgressionState>;
    const totalXp = Number(parsed.totalXp);
    const winStreak = Number(parsed.winStreak);
    const gamesPlayed = Number(parsed.gamesPlayed);
    if (!Number.isFinite(totalXp) || !Number.isFinite(winStreak) || !Number.isFinite(gamesPlayed)) {
      return INITIAL_PROGRESSION;
    }
    return { totalXp, winStreak, gamesPlayed };
  } catch {
    return INITIAL_PROGRESSION;
  }
}

export function saveProgression(state: ProgressionState) {
  try {
    window.localStorage?.setItem(KEY, JSON.stringify(state));
  } catch {
    // La progression ne survivra pas au rechargement, sans consequence sur le jeu.
  }
}
