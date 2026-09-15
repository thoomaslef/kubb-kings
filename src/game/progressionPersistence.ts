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
    // totalWins est un champ ajoute apres coup : absent d'une sauvegarde
    // anterieure, il ne doit PAS invalider le reste (le joueur perdrait son
    // niveau) — simplement retomber a 0 dans ce cas precis.
    const totalWins = Number(parsed.totalWins);
    return { totalXp, winStreak, gamesPlayed, totalWins: Number.isFinite(totalWins) ? totalWins : 0 };
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
