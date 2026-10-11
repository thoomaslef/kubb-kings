/**
 * Mode compatibilite : un dessin simplifie pour les appareils qui font planter le navigateur.
 *
 * Signale : un iPhone 13 mini sur lequel Safari affiche « Un probleme recurrent est survenu » —
 * l'onglet planterait a repetition au chargement. On ne peut pas reproduire ce plantage ici, et sa
 * cause exacte (accelération graphique, memoire...) reste inconnue. On rend donc le jeu capable de
 * SE RATTRAPER seul, quelle qu'en soit la cause :
 *
 *   - au demarrage du moteur graphique on note « un demarrage est en cours » ;
 *   - une fois le jeu stable depuis quelques secondes, ou si la page se ferme NORMALEMENT
 *     (evenement `pagehide`), on efface cette note ;
 *   - si la note est ENCORE LA au chargement suivant, le demarrage precedent n'est jamais alle au
 *     bout — l'onglet a ete tue : on passe en mode compatibilite.
 *
 * Mode compatibilite : rendu Canvas 2D (pas de WebGL), definition 1x (pas de super-resolution),
 * aucun effet graphique (halo du roi, vignette). Moins beau, mais il joue exactement le meme jeu.
 *
 * Force a la main : `?safe=1` dans l'adresse (retenu ensuite), `?safe=0` pour revenir au rendu normal.
 */
const ATTEMPT_KEY = 'kubb-kings.boot-attempt';
const FORCED_KEY = 'kubb-kings.safe-mode';
/** Delai de stabilite apres lequel on estime que le demarrage s'est bien passe. */
const HEALTHY_AFTER_MS = 4000;

export type SafeModeReason = 'url' | 'remembered' | 'crash' | null;

let decided: { on: boolean; reason: SafeModeReason } | null = null;

function read(key: string): string | null {
  try {
    return window.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage?.removeItem(key);
    else window.localStorage?.setItem(key, value);
  } catch {
    // Sans stockage, ni la detection ni le souvenir ne sont possibles : le mode normal reste.
  }
}

/** Decide UNE fois par chargement de page, avant de creer le moteur graphique. */
function decide(): { on: boolean; reason: SafeModeReason } {
  let param: string | null = null;
  try {
    param = new URLSearchParams(window.location.search).get('safe');
  } catch {
    // Adresse illisible : pas de parametre.
  }

  if (param === '0') {
    // Retour volontaire au rendu normal : on efface aussi le souvenir d'un plantage.
    write(FORCED_KEY, null);
    write(ATTEMPT_KEY, null);
    return { on: false, reason: null };
  }
  if (param === '1') {
    write(FORCED_KEY, '1');
    return { on: true, reason: 'url' };
  }
  if (read(FORCED_KEY) === '1') return { on: true, reason: 'remembered' };
  if (read(ATTEMPT_KEY) !== null) {
    // Le demarrage precedent n'est jamais alle au bout : on retient le mode compatibilite.
    write(FORCED_KEY, '1');
    return { on: true, reason: 'crash' };
  }
  return { on: false, reason: null };
}

export function isSafeMode(): boolean {
  decided ??= decide();
  return decided.on;
}

/** Pourquoi le mode compatibilite est actif (pour l'expliquer au joueur). */
export function safeModeReason(): SafeModeReason {
  decided ??= decide();
  return decided.reason;
}

/**
 * A appeler JUSTE AVANT de creer le moteur graphique. Pose la note de demarrage, la retire quand
 * le jeu est stable ou que la page se ferme normalement.
 */
export function beginBoot() {
  decided ??= decide();
  write(ATTEMPT_KEY, String(Date.now()));
  const clear = () => write(ATTEMPT_KEY, null);
  window.addEventListener('pagehide', clear, { once: true });
  setTimeout(clear, HEALTHY_AFTER_MS);
}

/** Quitter le mode compatibilite : on efface le souvenir, puis on recharge la page. */
export function leaveSafeMode() {
  write(FORCED_KEY, null);
  write(ATTEMPT_KEY, null);
  const url = new URL(window.location.href);
  url.searchParams.set('safe', '0');
  window.location.replace(url.toString());
}

/** Pour les verifications. */
export function resetSafeModeForTests() {
  decided = null;
}
