import { clampRank } from '../ranks';

/**
 * Classement des parties classees : ce que le serveur renvoie, nettoye.
 *
 * Le JSON distant n'est jamais cru sur parole (comme profileSnapshot.ts) : un
 * rang hors echelle, un pseudo demesure ou une ligne bancale ne doivent ni
 * casser l'ecran ni s'y afficher tels quels.
 */
export interface LeaderboardEntry {
  place: number;
  /** Pseudo GENERE par le serveur (« RapideViking42 »), jamais saisi par le joueur. */
  pseudo: string;
  rankIndex: number;
  peak: number;
  wins: number;
  losses: number;
  isMe: boolean;
}

export interface Standing {
  pseudo: string | null;
  /** Le joueur accepte d'apparaitre au classement. */
  visible: boolean;
  /** null : pas classe (aucune partie classee jouee, ou masque). */
  place: number | null;
  /** Joueurs classes en tout. */
  total: number;
}

const MAX_PSEUDO = 32;

function nonNegativeInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Texte affichable : retire les caracteres de controle et borne la longueur. */
export function cleanPseudo(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, MAX_PSEUDO);
  return text.length > 0 ? text : null;
}

export function sanitizeEntries(raw: unknown): LeaderboardEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: LeaderboardEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const pseudo = cleanPseudo(r.pseudo);
    if (!pseudo) continue;
    const rankIndex = clampRank(Number(r.rank_index));
    entries.push({
      place: Math.max(1, nonNegativeInt(r.place)),
      pseudo,
      rankIndex,
      peak: Math.max(rankIndex, clampRank(Number(r.rank_peak))),
      wins: nonNegativeInt(r.wins),
      losses: nonNegativeInt(r.losses),
      isMe: r.is_me === true
    });
  }
  // L'ordre est celui du serveur ; on le rend simplement stable par place.
  return entries.sort((a, b) => a.place - b.place);
}

export function sanitizeStanding(raw: unknown): Standing | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const place = nonNegativeInt(r.place);
  return {
    pseudo: cleanPseudo(r.pseudo),
    visible: r.visible !== false,
    place: place > 0 ? place : null,
    total: nonNegativeInt(r.total)
  };
}
