/**
 * Succes (Phase 4 de la progression) : defis ponctuels, debloques une seule
 * fois par appareil (persistes, comme les articles de boutique) et
 * recompenses en XP + pieces au moment ou ils sont franchis. Cote equipe
 * Bleue uniquement (le profil), comme le reste de la progression.
 *
 * Detection dans MatchScene (aucun effet sur l'IA ni sur les regles) :
 * chaque succes gagne pendant la partie est accumule (achievementsEarnedThisMatch),
 * puis transmis une seule fois en fin de partie a useGameStore::unlockAchievements
 * — qui filtre lui-meme ceux deja possedes avant de persister, meme discipline
 * que purchaseItem dans shop.ts.
 */

export type AchievementId =
  | 'double'
  | 'triple'
  | 'perfect'
  | 'kubb-eloigne'
  | 'sans-faute'
  | 'victoire-parfaite'
  | 'ricochet'
  | 'roi-dernier-lancer';

export interface Achievement {
  id: AchievementId;
  xp: number;
  coins: number;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'double', xp: 150, coins: 50 },
  { id: 'triple', xp: 250, coins: 75 },
  { id: 'perfect', xp: 350, coins: 100 },
  { id: 'kubb-eloigne', xp: 150, coins: 50 },
  { id: 'ricochet', xp: 150, coins: 50 },
  { id: 'sans-faute', xp: 400, coins: 150 },
  { id: 'victoire-parfaite', xp: 350, coins: 125 },
  { id: 'roi-dernier-lancer', xp: 400, coins: 150 }
];
