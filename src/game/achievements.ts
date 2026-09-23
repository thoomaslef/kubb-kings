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
  | 'roi-dernier-lancer'
  | 'frolement'
  | 'nettoyeur'
  | 'dans-le-vent'
  | 'chirurgien'
  | 'remontada'
  | 'collectionneur'
  | 'increvable';

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
  { id: 'roi-dernier-lancer', xp: 400, coins: 150 },
  { id: 'frolement', xp: 250, coins: 75 },
  { id: 'nettoyeur', xp: 250, coins: 75 },
  { id: 'dans-le-vent', xp: 150, coins: 50 },
  { id: 'chirurgien', xp: 400, coins: 150 },
  { id: 'remontada', xp: 350, coins: 125 },
  { id: 'collectionneur', xp: 500, coins: 200 },
  { id: 'increvable', xp: 600, coins: 250 }
];

/**
 * Seuils de detection, nommes ici plutot qu'en dur dans MatchScene : ce sont
 * des reglages de succes, sans aucun effet sur les regles ni sur l'IA.
 */

/**
 * "Frolement" : distance maximale au CENTRE du roi ou le baton doit
 * s'immobiliser au tir d'ouverture, sans l'avoir touche. Le rayon de
 * collision du roi vaut ~27px (HITBOX.kingRadius + batonWidth/2) : 60px du
 * centre laisse donc une marge reelle d'a peine ~33px.
 */
export const GRAZE_MAX_DISTANCE = 60;

/** "Nettoyeur" : kubbs de champ a degager dans une meme manche. */
export const FIELD_KUBBS_CLEARED_TARGET = 3;

/** "Remontada" : nombre de kubbs encore debout en dessous duquel la remontee compte. */
export const COMEBACK_MAX_STANDING = 1;
