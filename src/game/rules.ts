/**
 * Constantes de regles et de geometrie du terrain.
 * Tout ce qui est "equilibrage" du MVP est centralise ici.
 */

/** Resolution de design (portrait 9:16). Phaser met a l'echelle vers l'ecran reel. */
export const DESIGN_WIDTH = 720;
export const DESIGN_HEIGHT = 1280;

/** Terrain rectangulaire vu de dessus, en coordonnees de design. */
export const FIELD = {
  x: 40,
  y: 130,
  width: 640,
  height: 1020
} as const;

export const FIELD_CENTER_X = FIELD.x + FIELD.width / 2;
export const FIELD_CENTER_Y = FIELD.y + FIELD.height / 2;

/** Distance entre la ligne de fond et le bord du terrain. */
export const BASELINE_INSET = 130;
/** Distance entre la position du lanceur et le bord du terrain. */
export const THROWER_INSET = 45;

/** Nombre de kubbs par equipe, alignes sur la ligne de fond. */
export const KUBBS_PER_TEAM = 5;
/** Ecartement horizontal entre deux kubbs. */
export const KUBB_SPACING = 120;

/** Duree maximale d'une partie (4 min) pour tenir dans la fenetre 3-5 min. */
export const MATCH_DURATION_MS = 4 * 60 * 1000;
/** Nombre de lancers par equipe. Garde-fou si le timer n'est pas atteint. */
export const MAX_THROWS_PER_TEAM = 12;

/** Vitesse d'impact minimale (px/step Matter) pour faire tomber un kubb. */
export const KNOCKDOWN_IMPACT_SPEED = 6;
/** Deviation aleatoire appliquee a chaque lancer, en degres. */
export const MAX_AIM_DEVIATION_DEG = 5;

/** Parametres du geste de visee. */
export const AIM = {
  /** Distance de drag (px) correspondant a 100% de puissance. */
  maxDragDistance: 420,
  minPower: 0.12,
  /** Ouverture maximale autorisee de part et d'autre de l'axe du terrain. */
  maxAngleDeg: 75
} as const;

/** Parametres du lancer. */
export const THROW = {
  /** Vitesse Matter au maximum de la jauge. */
  maxSpeed: 30,
  /** Rotation visuelle du baton en vol. */
  spin: 0.35,
  /** Duree max d'un lancer avant resolution forcee. */
  maxFlightMs: 4000,
  /** En dessous de cette vitesse, le baton est considere immobile. */
  restSpeed: 1.2,
  /** Temps sous restSpeed avant de cloturer le tour. */
  restDelayMs: 220
} as const;
