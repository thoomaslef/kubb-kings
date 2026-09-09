import type Phaser from 'phaser';

/**
 * Config Matter.js pour une vue de dessus :
 * pas de gravite, l'amortissement vient du frottement de l'air (frictionAir).
 */
export const matterWorldConfig: Phaser.Types.Physics.Matter.MatterWorldConfig = {
  gravity: { x: 0, y: 0 },
  debug: false,
  // Un peu plus d'iterations : les impacts baton/kubb restent stables a haute vitesse.
  positionIterations: 8,
  velocityIterations: 6
};

/** Corps du baton lance : leger, glissant, rebondit un peu sur les bandes. */
export const BATON_BODY = {
  frictionAir: 0.015,
  friction: 0.02,
  restitution: 0.35,
  density: 0.004,
  label: 'baton'
} as const;

/** Corps d'un kubb : lourd et tres amorti, il ne derive pas apres un choc. */
export const KUBB_BODY = {
  frictionAir: 0.35,
  friction: 0.6,
  restitution: 0.1,
  density: 0.02,
  label: 'kubb'
} as const;

/** Corps du roi : encore plus stable que les kubbs. */
export const KING_BODY = {
  frictionAir: 0.45,
  friction: 0.7,
  restitution: 0.1,
  density: 0.03,
  label: 'king'
} as const;

/** Bandes du terrain. */
export const WALL_BODY = {
  isStatic: true,
  restitution: 0.25,
  friction: 0.1,
  label: 'wall'
} as const;

/** Rocher d'un terrain a obstacles : statique, un rebond plus sec qu'une bande. */
export const OBSTACLE_BODY = {
  isStatic: true,
  restitution: 0.4,
  friction: 0.2,
  label: 'obstacle'
} as const;
