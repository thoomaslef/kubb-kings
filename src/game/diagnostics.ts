/**
 * Journal d'erreurs minimal, en localStorage.
 *
 * Le jeu est un site statique (GitHub Pages) : il n'y a aucun serveur pour
 * recevoir des rapports de crash a distance. Ce module ne pretend pas
 * resoudre ce manque — il donne juste au joueur un moyen de RETROUVER et
 * COPIER les dernieres erreurs (ecran A propos), pour les transmettre
 * manuellement si besoin. Honnete sur la limite plutot que d'ajouter un
 * SDK tiers pour la contourner.
 */

const KEY = 'kubb-kings.crash-log';
const MAX_ENTRIES = 20;

export interface CrashEntry {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
  userAgent: string;
}

function read(): CrashEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CrashEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: CrashEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // Stockage indisponible (navigation privee, quota plein) : rien de plus a faire.
  }
}

export function recordCrash(error: Error, componentStack?: string) {
  const entries = read();
  entries.push({
    message: error.message,
    stack: error.stack,
    componentStack,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent
  });
  write(entries);
}

export function getCrashLog(): CrashEntry[] {
  return read();
}

export function clearCrashLog() {
  write([]);
}

/** Format texte simple, pret a copier-coller dans un e-mail de support. */
export function formatCrashLogForCopy(): string {
  const entries = read();
  if (entries.length === 0) return 'Aucune erreur enregistree.';

  return entries
    .map((e) => {
      const parts = [`[${e.timestamp}] ${e.message}`];
      if (e.stack) parts.push(e.stack);
      if (e.componentStack) parts.push(`Composant : ${e.componentStack}`);
      parts.push(e.userAgent);
      return parts.join('\n');
    })
    .join('\n\n---\n\n');
}

/**
 * A appeler une seule fois au demarrage : capture les erreurs qui echappent
 * a un ErrorBoundary React (code hors rendu — la boucle Phaser en fait
 * partie — et promesses rejetees sans handler).
 */
export function installGlobalCrashHandlers() {
  window.addEventListener('error', (event) => {
    recordCrash(event.error instanceof Error ? event.error : new Error(String(event.message)));
  });
  window.addEventListener('unhandledrejection', (event) => {
    recordCrash(event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
  });
}
