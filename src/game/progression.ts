/**
 * Progression du joueur : niveau, titre et XP, persistes localement (voir
 * progressionPersistence.ts) et communs a tous les modes de jeu — un seul
 * profil, sur cet appareil, pas un profil par mode.
 *
 * En local (1v1/2v2, tournoi), seules les performances de l'equipe Bleue
 * comptent : c'est elle "le joueur" au sens du profil, meme quand un second
 * humain joue Rouge sur le meme appareil (cf. Team.ts : "le joueur garde le
 * bleu, qui commence").
 */

/** Etat persiste : XP cumulee (toutes manches confondues) et serie de victoires en cours. */
export interface ProgressionState {
  totalXp: number;
  winStreak: number;
  gamesPlayed: number;
}

export const INITIAL_PROGRESSION: ProgressionState = { totalXp: 0, winStreak: 0, gamesPlayed: 0 };

/**
 * Palier de titre par niveau (le plus haut palier <= niveau s'applique).
 * Purement cosmetique — aucun effet sur les regles ni sur l'IA.
 */
const LEVEL_TITLES: ReadonlyArray<{ minLevel: number; icon: string; titleKey: string }> = [
  { minLevel: 1, icon: '🪵', titleKey: 'progression.title.debutant' },
  { minLevel: 5, icon: '🪵', titleKey: 'progression.title.amateur' },
  { minLevel: 10, icon: '🎯', titleKey: 'progression.title.confirme' },
  { minLevel: 16, icon: '🏹', titleKey: 'progression.title.elite' },
  { minLevel: 24, icon: '👑', titleKey: 'progression.title.maitre' },
  { minLevel: 32, icon: '🔥', titleKey: 'progression.title.legende' }
];

function titleForLevel(level: number) {
  let current = LEVEL_TITLES[0];
  for (const tier of LEVEL_TITLES) {
    if (level < tier.minLevel) break;
    current = tier;
  }
  return current;
}

/** XP necessaire pour passer du niveau `level` au niveau `level + 1` : croissance lineaire douce. */
export function xpForLevel(level: number): number {
  return 100 + (level - 1) * 25;
}

export interface LevelInfo {
  level: number;
  icon: string;
  titleKey: string;
  /** XP deja acquise dans le niveau courant. */
  xpIntoLevel: number;
  /** XP totale necessaire pour passer au niveau suivant. */
  xpForThisLevel: number;
  totalXp: number;
}

/** Deduit niveau + progression dans le niveau a partir de l'XP totale cumulee. */
export function levelFromXp(totalXp: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, totalXp);
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level += 1;
  }
  const { icon, titleKey } = titleForLevel(level);
  return { level, icon, titleKey, xpIntoLevel: remaining, xpForThisLevel: xpForLevel(level), totalXp };
}

/**
 * Bareme des points d'XP, un par critere annonce (victoire, precision, coups
 * difficiles, eliminations multiples, victoire parfaite, serie de
 * victoires). Les compteurs par match (precision/difficult/doubles/triples/
 * perfects) viennent des memes evenements que le combo (Phase 1,
 * MatchScene::resolveComboFeedback) — la progression recompense donc
 * exactement ce que le joueur voit deja recompense a l'ecran pendant le match.
 */
export const XP_RULES = {
  win: 100,
  perfectWin: 50,
  precisionHit: 5,
  difficultHit: 15,
  doubleHit: 20,
  tripleHit: 40,
  perfectHit: 80,
  /** Par victoire de serie, plafonne a XP_RULES.streakCap victoires. */
  streakPerWin: 5,
  streakCap: 10
} as const;

/** Compteurs d'un match, cote equipe Bleue, necessaires au calcul de l'XP gagnee. */
export interface MatchXpStats {
  won: boolean;
  /** Victoire ET aucun kubb Bleu abattu de toute la partie. */
  perfectWin: boolean;
  precisionHits: number;
  difficultHits: number;
  doubles: number;
  triples: number;
  perfects: number;
}

export interface XpAward {
  total: number;
  win: number;
  perfectWin: number;
  precision: number;
  difficult: number;
  multi: number;
  streak: number;
  /** Serie de victoires APRES ce match (deja incrementee/remise a zero). */
  winStreakAfter: number;
  levelBefore: number;
  levelAfter: number;
}

/**
 * Calcule le gain d'XP d'un match et le nouvel etat de progression. Pure :
 * ne touche pas au stockage (voir progressionPersistence.ts / useGameStore).
 */
export function computeXpAward(stats: MatchXpStats, before: ProgressionState): { award: XpAward; after: ProgressionState } {
  const win = stats.won ? XP_RULES.win : 0;
  const perfectWin = stats.won && stats.perfectWin ? XP_RULES.perfectWin : 0;
  const precision = stats.precisionHits * XP_RULES.precisionHit;
  const difficult = stats.difficultHits * XP_RULES.difficultHit;
  const multi = stats.doubles * XP_RULES.doubleHit + stats.triples * XP_RULES.tripleHit + stats.perfects * XP_RULES.perfectHit;

  const winStreakAfter = stats.won ? before.winStreak + 1 : 0;
  const streak = stats.won ? Math.min(winStreakAfter, XP_RULES.streakCap) * XP_RULES.streakPerWin : 0;

  const total = win + perfectWin + precision + difficult + multi + streak;
  const levelBefore = levelFromXp(before.totalXp).level;
  const totalXpAfter = before.totalXp + total;
  const levelAfter = levelFromXp(totalXpAfter).level;

  return {
    award: { total, win, perfectWin, precision, difficult, multi, streak, winStreakAfter, levelBefore, levelAfter },
    after: { totalXp: totalXpAfter, winStreak: winStreakAfter, gamesPlayed: before.gamesPlayed + 1 }
  };
}
