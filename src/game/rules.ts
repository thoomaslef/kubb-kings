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

/** Distance entre la ligne de fond (les kubbs) et le bord du terrain. */
export const BASELINE_INSET = 60;
/**
 * Distance entre la position du lanceur et le bord du terrain.
 * Superieure a BASELINE_INSET : le lanceur se place devant ses propres kubbs,
 * qui ne sont donc jamais sur la trajectoire de son baton.
 */
export const THROWER_INSET = 130;

/**
 * Marge entre le bord du terrain et la position de lancer extreme.
 * Partagee par la scene (qui trace la ligne) et l'IA (qui choisit ou se placer).
 */
export const THROW_LINE_MARGIN = 40;

/** Nombre de kubbs par equipe, alignes sur la ligne de fond. */
export const KUBBS_PER_TEAM = 5;
/** Ecartement horizontal entre deux kubbs. */
export const KUBB_SPACING = 120;

/** Duree maximale d'une partie (4 min) pour tenir dans la fenetre 3-5 min. */
export const MATCH_DURATION_MS = 4 * 60 * 1000;
/** Nombre de lancers par equipe. Garde-fou si le timer n'est pas atteint. */
export const MAX_THROWS_PER_TEAM = 12;

/**
 * Dimensions des corps physiques, en pixels de design.
 *
 * Volontairement independantes des textures : le rendu peut etre retouche
 * sans que les collisions bougent. Ce sont les valeurs du MVP, reprises telles
 * quelles depuis les anciennes tailles de texture.
 */
export const HITBOX = {
  kubb: 36,
  batonWidth: 14,
  batonLength: 62,
  kingRadius: 20
} as const;

/** Vitesse d'impact minimale (px/step Matter) pour faire tomber un kubb. */
export const KNOCKDOWN_IMPACT_SPEED = 6;
/**
 * Deviation aleatoire appliquee a chaque lancer, en degres.
 *
 * Etait a 5 dans le MVP initial. A la distance du terrain, 5 deg valent
 * +/-72 px de derive laterale — plus large qu'un kubb (36 px) espace de
 * 120 px : la precision du joueur ne changeait presque rien au resultat
 * (voir le calibrage de l'IA dans ai.ts, qui l'a mis en evidence). Baisse a
 * 2.5 pour que bien viser recommence a payer.
 */
export const MAX_AIM_DEVIATION_DEG = 2.5;

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
  /**
   * Duree max d'un lancer avant resolution forcee.
   * Un filet de securite pour les cas pathologiques (rebonds infinis entre
   * deux bandes) : en jeu normal, restSpeed/restDelayMs cloturent le tour
   * bien avant.
   */
  maxFlightMs: 3000,
  /**
   * En dessous de cette vitesse, le baton est considere immobile.
   *
   * Volontairement proche de KNOCKDOWN_IMPACT_SPEED (6) sans l'atteindre :
   * une fois sous ce seuil, le baton ne peut plus, par definition, faire
   * tomber quoi que ce soit. On peut donc clore le tour sans attendre qu'il
   * s'immobilise vraiment — c'etait l'essentiel du "temps mort" en fin de
   * lancer, un baton qui rampait sans plus aucune consequence de jeu.
   */
  restSpeed: 4,
  /** Temps sous restSpeed avant de cloturer le tour. */
  restDelayMs: 160
} as const;
