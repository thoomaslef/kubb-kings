import { clampRank, type RankState } from '../ranks';
import type { ProgressionState } from '../progression';

/**
 * Ce qui suit le joueur d'un appareil a l'autre : sa progression.
 *
 * Volontairement PAS dedans : la langue, le son, le tutoriel deja vu — ce
 * sont des reglages de l'APPAREIL, pas du joueur (un joueur peut vouloir
 * l'anglais sur un telephone et le francais sur l'autre).
 *
 * Module pur, comme ranks.ts : ni reseau, ni stockage, ni store. Tout ce qui
 * entre depuis le serveur passe par `sanitizeSnapshot` : le JSON distant n'est
 * jamais cru sur parole, il peut etre vide, tronque ou d'une version plus
 * ancienne.
 */
export interface ProfileSnapshot {
  /** Version du format, pour pouvoir le faire evoluer sans casser les anciens comptes. */
  v: 1;
  progression: ProgressionState;
  coins: number;
  ownedItems: string[];
  unlockedAchievements: string[];
  terrainWins: string[];
  onlineWinStreak: number;
  rank: RankState;
  /** Meilleure manche franchie en mode Defi. */
  bestStage: number;
}

/** Taille maximale acceptee d'une liste distante : un compte ne peut pas gonfler la base sans limite. */
const MAX_LIST = 500;

export function emptySnapshot(): ProfileSnapshot {
  return {
    v: 1,
    progression: { totalXp: 0, winStreak: 0, gamesPlayed: 0, totalWins: 0 },
    coins: 0,
    ownedItems: [],
    unlockedAchievements: [],
    terrainWins: [],
    onlineWinStreak: 0,
    rank: { index: 0, wins: 0, losses: 0, peak: 0 },
    bestStage: 0
  };
}

function nonNegativeInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item === 'string' && item.length > 0 && item.length <= 80) seen.add(item);
    if (seen.size >= MAX_LIST) break;
  }
  return [...seen];
}

/** Valide un JSON venu du serveur ; null s'il n'a pas la forme d'un profil. */
export function sanitizeSnapshot(value: unknown): ProfileSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const prog = (raw.progression ?? {}) as Record<string, unknown>;
  const rank = (raw.rank ?? {}) as Record<string, unknown>;
  const index = clampRank(Number(rank.index));
  return {
    v: 1,
    progression: {
      totalXp: nonNegativeInt(prog.totalXp),
      winStreak: nonNegativeInt(prog.winStreak),
      gamesPlayed: nonNegativeInt(prog.gamesPlayed),
      totalWins: nonNegativeInt(prog.totalWins)
    },
    coins: nonNegativeInt(raw.coins),
    ownedItems: stringList(raw.ownedItems),
    unlockedAchievements: stringList(raw.unlockedAchievements),
    terrainWins: stringList(raw.terrainWins),
    onlineWinStreak: nonNegativeInt(raw.onlineWinStreak),
    rank: {
      index,
      wins: nonNegativeInt(rank.wins),
      losses: nonNegativeInt(rank.losses),
      peak: Math.max(index, clampRank(Number(rank.peak)))
    },
    bestStage: nonNegativeInt(raw.bestStage)
  };
}

/** Un profil sans la moindre progression : un nouvel appareil, ou un compte tout neuf. */
export function isPristine(s: ProfileSnapshot): boolean {
  return (
    s.progression.totalXp === 0 &&
    s.progression.gamesPlayed === 0 &&
    s.coins === 0 &&
    s.ownedItems.length === 0 &&
    s.unlockedAchievements.length === 0 &&
    s.terrainWins.length === 0 &&
    s.bestStage === 0 &&
    s.rank.wins === 0 &&
    s.rank.losses === 0
  );
}

const sorted = (list: readonly string[]) => [...list].sort();

/** Egalite de contenu (l'ordre des listes ne compte pas) : evite d'envoyer au serveur ce qu'il a deja. */
export function snapshotsEqual(a: ProfileSnapshot, b: ProfileSnapshot): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function canonical(s: ProfileSnapshot) {
  return {
    ...s,
    ownedItems: sorted(s.ownedItems),
    unlockedAchievements: sorted(s.unlockedAchievements),
    terrainWins: sorted(s.terrainWins)
  };
}

const union = (a: readonly string[], b: readonly string[]) => stringList([...a, ...b]);

/**
 * « Le meilleur des deux » : ce qu'on obtient en fusionnant deux profils.
 *
 * - XP / niveau : le profil qui a le PLUS d'XP fournit tout le bloc (XP,
 *   serie, parties, victoires restent coherentes entre elles) ;
 * - succes, articles, terrains gagnes : l'UNION ;
 * - meilleure manche du Defi, meilleure serie en ligne : le maximum ;
 * - rang : celui du profil qui a joue le plus de parties classees (c'est le
 *   plus a jour), a egalite le plus haut ;
 * - pieces : le MAXIMUM — et c'est le compromis connu de cette fusion : des
 *   pieces depensees sur un appareil peuvent reapparaitre. Elle n'est
 *   proposee qu'au premier rapprochement de deux profils qui ont chacun leur
 *   histoire, jamais en synchronisation courante.
 */
export function mergeBest(a: ProfileSnapshot, b: ProfileSnapshot): ProfileSnapshot {
  const gamesA = a.rank.wins + a.rank.losses;
  const gamesB = b.rank.wins + b.rank.losses;
  const rank = gamesA !== gamesB ? (gamesA > gamesB ? a.rank : b.rank) : a.rank.index >= b.rank.index ? a.rank : b.rank;
  return {
    v: 1,
    progression: { ...(a.progression.totalXp >= b.progression.totalXp ? a.progression : b.progression) },
    coins: Math.max(a.coins, b.coins),
    ownedItems: union(a.ownedItems, b.ownedItems),
    unlockedAchievements: union(a.unlockedAchievements, b.unlockedAchievements),
    terrainWins: union(a.terrainWins, b.terrainWins),
    onlineWinStreak: Math.max(a.onlineWinStreak, b.onlineWinStreak),
    rank: { ...rank, peak: Math.max(a.rank.peak, b.rank.peak, rank.index) },
    bestStage: Math.max(a.bestStage, b.bestStage)
  };
}
