/**
 * Joueurs bloques, sur CET appareil seulement.
 *
 * Bloquer un pseudo le fait disparaitre du classement affiche : rien n'est envoye a un serveur (le blocage est
 * un confort personnel, le SIGNALEMENT — account/sync.ts::reportPlayer — est ce qui previent l'editeur).
 * Les pseudos sont compares sans tenir compte de la casse. Au plus MAX_BLOCKED pseudos : au-dela, le plus ancien tombe.
 */
const KEY = 'kubb-kings.blocked-pseudos';
export const MAX_BLOCKED = 100;

const norm = (pseudo: string) => pseudo.trim().toLowerCase();

export function loadBlocked(): string[] {
  try {
    const raw = window.localStorage?.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((p): p is string => typeof p === 'string').slice(-MAX_BLOCKED) : [];
  } catch {
    return [];
  }
}

function save(list: string[]) {
  try {
    window.localStorage?.setItem(KEY, JSON.stringify(list.slice(-MAX_BLOCKED)));
  } catch {
    // Sans stockage, le blocage dure jusqu'a la fermeture de la page : sans danger.
  }
}

export function blockPseudo(pseudo: string): string[] {
  const n = norm(pseudo);
  const list = loadBlocked();
  if (!n || list.includes(n)) return list;
  const next = [...list, n].slice(-MAX_BLOCKED);
  save(next);
  return next;
}

export function unblockAll(): string[] {
  save([]);
  return [];
}

/** Garde les lignes dont le pseudo n'est pas bloque. */
export function withoutBlocked<T extends { pseudo: string }>(rows: T[], blocked: string[]): T[] {
  if (blocked.length === 0) return rows;
  const set = new Set(blocked);
  return rows.filter((r) => !set.has(norm(r.pseudo)));
}
