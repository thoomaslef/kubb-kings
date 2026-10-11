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
 * La note est ecrite a DEUX endroits. Dans le stockage de l'ONGLET (`sessionStorage`) d'abord : il
 * n'appartient qu'a cet onglet, donc un autre onglet qui demarre au meme moment ne peut pas la
 * confondre avec un plantage — la premiere version utilisait le stockage partage, et deux onglets
 * ouverts a quelques secondes d'ecart faisaient basculer le second en mode compatibilite. Dans le
 * stockage partage (`localStorage`) ensuite, au cas ou l'onglet perdrait le sien en plantant ; on
 * ne la croit alors qu'APRES `STALE_AFTER_MS` : plus jeune, c'est un autre onglet en train de demarrer.
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
/** Age a partir duquel une note du stockage PARTAGE n'est plus celle d'un autre onglet en train de demarrer. */
const STALE_AFTER_MS = 6000;

export type SafeModeReason = 'url' | 'remembered' | 'crash' | null;

let decided: { on: boolean; reason: SafeModeReason } | null = null;

function read(key: string): string | null {
  try {
    return window.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function readSession(key: string): string | null {
  try {
    return window.sessionStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage?.removeItem(key);
    else window.sessionStorage?.setItem(key, value);
  } catch {
    // Sans stockage d'onglet, il reste la note partagee.
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

/** Une note de demarrage est-elle restee, et est-ce bien celle d'un demarrage qui a plante ? */
function previousBootNeverFinished(): boolean {
  // Stockage de l'onglet : seul cet onglet a pu l'ecrire, aucune ambiguite.
  if (readSession(ATTEMPT_KEY) !== null) return true;
  // Stockage partage : peut etre celle d'un AUTRE onglet qui demarre en ce moment, sauf si elle est ancienne.
  const shared = Number(read(ATTEMPT_KEY));
  return Number.isFinite(shared) && shared > 0 && Date.now() - shared >= STALE_AFTER_MS;
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
    writeSession(ATTEMPT_KEY, null);
    return { on: false, reason: null };
  }
  if (param === '1') {
    write(FORCED_KEY, '1');
    return { on: true, reason: 'url' };
  }
  if (read(FORCED_KEY) === '1') return { on: true, reason: 'remembered' };
  if (previousBootNeverFinished()) {
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
  const now = String(Date.now());
  writeSession(ATTEMPT_KEY, now);
  // Partage : on garde l'heure du PREMIER demarrage encore en cours (un deuxieme onglet ne la rajeunit pas),
  // sans quoi une boucle de plantages ne vieillirait jamais la note.
  if (read(ATTEMPT_KEY) === null) write(ATTEMPT_KEY, now);
  const clear = () => {
    writeSession(ATTEMPT_KEY, null);
    write(ATTEMPT_KEY, null);
  };
  window.addEventListener('pagehide', clear, { once: true });
  setTimeout(clear, HEALTHY_AFTER_MS);
}

/** Quitter le mode compatibilite : on efface le souvenir, puis on recharge la page. */
export function leaveSafeMode() {
  write(FORCED_KEY, null);
  write(ATTEMPT_KEY, null);
  writeSession(ATTEMPT_KEY, null);
  const url = new URL(window.location.href);
  url.searchParams.set('safe', '0');
  window.location.replace(url.toString());
}

/** Pour les verifications. */
export function resetSafeModeForTests() {
  decided = null;
}
