import { clampRank, initialRankState, type RankState } from './ranks';

/**
 * Rang du joueur, conserve sur l'appareil — meme modele que
 * onlineStreakPersistence.ts. Un stockage illisible ou rempli de n'importe
 * quoi ramene au rang de depart plutot que de planter ou d'accorder un rang
 * fantaisiste.
 *
 * LOCAL a l'appareil, et c'est une limite assumee : rien ne l'empeche d'etre
 * modifie a la main, et il ne suit pas le joueur d'un telephone a l'autre.
 * Un rang qui compte vraiment demande un compte et un serveur qui arbitre.
 */
const RANK_KEY = 'kubb-kings.rank';
/**
 * Marqueur « une partie classee est en cours ». Pose au depart, retire a la
 * fin de la partie, quelle qu'elle soit : s'il est ENCORE la au chargement
 * suivant, le joueur a ferme l'onglet en pleine partie, ce qui compte comme un
 * abandon. Sans lui, fermer l'onglet serait le moyen gratuit d'echapper a une
 * defaite.
 */
const PENDING_KEY = 'kubb-kings.ranked-pending';

function nonNegativeInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function loadRank(): RankState {
  try {
    const raw = window.localStorage?.getItem(RANK_KEY);
    if (!raw) return initialRankState();
    const parsed = JSON.parse(raw) as Partial<RankState> | null;
    if (!parsed || typeof parsed !== 'object') return initialRankState();
    const index = clampRank(Number(parsed.index));
    return {
      index,
      wins: nonNegativeInt(parsed.wins),
      losses: nonNegativeInt(parsed.losses),
      // Le meilleur rang ne peut etre en dessous du rang actuel.
      peak: Math.max(index, clampRank(Number(parsed.peak)))
    };
  } catch {
    return initialRankState();
  }
}

export function saveRank(state: RankState) {
  try {
    window.localStorage?.setItem(RANK_KEY, JSON.stringify(state));
  } catch {
    // Le rang ne survivra pas au rechargement, sans consequence sur le jeu.
  }
}

export function hasPendingRankedMatch(): boolean {
  try {
    return window.localStorage?.getItem(PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function setPendingRankedMatch(pending: boolean) {
  try {
    if (pending) window.localStorage?.setItem(PENDING_KEY, '1');
    else window.localStorage?.removeItem(PENDING_KEY);
  } catch {
    // Sans stockage, l'abandon par fermeture d'onglet ne peut pas etre detecte.
  }
}
