/**
 * Persistance du tutoriel de premiere partie.
 *
 * Deux drapeaux independants, sur le meme modele que la preference de son
 * (audio.ts) : `localStorage` peut jeter (navigation privee, site data
 * bloque), donc chaque acces est protege et retombe sur "pas encore vu" —
 * moins genant que planter l'ecran de jeu pour un tutoriel.
 */

const INTRO_KEY = 'kubb-kings.tutorial-done';
const KING_TIP_KEY = 'kubb-kings.tutorial-king-tip-done';

function read(key: string): boolean {
  try {
    return window.localStorage?.getItem(key) === '1';
  } catch {
    return false;
  }
}

function write(key: string, value: boolean) {
  try {
    if (value) window.localStorage?.setItem(key, '1');
    else window.localStorage?.removeItem(key);
  } catch {
    /* le tutoriel rejouera simplement a la prochaine partie */
  }
}

/** Le joueur a-t-il deja termine (ou quitte) une premiere partie ? */
export function isTutorialDone(): boolean {
  return read(INTRO_KEY);
}

export function markTutorialDone() {
  write(INTRO_KEY, true);
}

/** La bulle detaillee sur le roi a-t-elle deja ete montree une fois ? */
export function isKingTipSeen(): boolean {
  return read(KING_TIP_KEY);
}

export function markKingTipSeen() {
  write(KING_TIP_KEY, true);
}

/** Depuis l'ecran des regles : "Revoir le tutoriel" a la prochaine partie. */
export function resetTutorial() {
  write(INTRO_KEY, false);
  write(KING_TIP_KEY, false);
}
