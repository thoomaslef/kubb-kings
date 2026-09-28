/**
 * Serie de victoires en ligne en cours, pour le succes "Invaincu" — sur le
 * meme modele que terrainWinsPersistence.ts.
 *
 * Deuxieme etat de succes CUMULATIF du jeu : il se construit d'une partie a
 * l'autre et doit donc survivre au rechargement de la page. Une defaite le
 * remet a zero ; un match nul le laisse tel quel, n'etant pas une defaite.
 */
const KEY = 'kubb-kings.online-streak';

export function loadOnlineStreak(): number {
  try {
    const raw = window.localStorage?.getItem(KEY);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  } catch {
    return 0;
  }
}

export function saveOnlineStreak(streak: number) {
  try {
    window.localStorage?.setItem(KEY, String(streak));
  } catch {
    // La serie ne survivra pas au rechargement, sans consequence sur le jeu.
  }
}
