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

/** Nombre de kubbs par equipe, alignes sur la ligne de fond. */
export const KUBBS_PER_TEAM = 5;
/** Ecartement horizontal entre deux kubbs. */
export const KUBB_SPACING = 120;

/**
 * Positions de lancer disponibles : uniquement a l'aplomb de ses propres
 * kubbs, comme au vrai Kubb — pas n'importe ou sur une ligne continue.
 * Memes 5 abscisses que Team.ts (qui aligne les kubbs sur la ligne de
 * fond) : les deux equipes partagent la meme rangee, seule leur ligne Y
 * differe. Partagees par la scene (qui les dessine et y accroche la
 * visee) et l'IA (qui choisit parmi elles).
 */
export const THROW_POSITIONS: readonly number[] = Array.from({ length: KUBBS_PER_TEAM }, (_, i) => {
  const first = -((KUBBS_PER_TEAM - 1) / 2) * KUBB_SPACING;
  return FIELD_CENTER_X + first + i * KUBB_SPACING;
});

/**
 * Positions reellement disponibles pour une equipe : celles de ses kubbs
 * ENCORE DEBOUT (`standing[i]` correspond a `THROW_POSITIONS[i]`, meme
 * ordre que Team.ts). Un kubb tombe n'est plus un poste de lancer valide.
 *
 * Si tous les kubbs de l'equipe sont a terre, elle doit pourtant continuer
 * a jouer (tant qu'il lui reste des lancers) : on retombe alors sur les 5
 * positions completes plutot que de la laisser sans aucun coup legal.
 */
export function availableThrowPositions(standing: readonly boolean[]): readonly number[] {
  const available = THROW_POSITIONS.filter((_, i) => standing[i]);
  return available.length > 0 ? available : THROW_POSITIONS;
}

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

/**
 * Terrains a obstacles.
 *
 * Chaque preset ajoute des rochers statiques, tous a la meme geometrie de
 * terrain (FIELD, KUBB_SPACING, hitboxes : rien de tout cela ne change) —
 * seuls des blocs supplementaires apparaissent, positionnes en decalage
 * (dx, dy) depuis le centre du terrain. Un rocher ne peut rien faire tomber
 * ni etre abattu : il fait juste rebondir le baton, comme une bande.
 */
export type FieldPresetId = 'classique' | 'chicane' | 'sentinelle';

export interface FieldPreset {
  id: FieldPresetId;
  /** Decalages (dx, dy) depuis FIELD_CENTER_X/Y, en pixels de design. */
  obstacles: ReadonlyArray<{ dx: number; dy: number }>;
}

/** Rayon d'un rocher, en pixels de design — un peu plus large que le roi. */
export const OBSTACLE_RADIUS = 22;

// Libelles et indices : src/i18n/dictionaries.ts (terrain.<id>.label / .hint).
export const FIELD_PRESETS: Record<FieldPresetId, FieldPreset> = {
  classique: {
    id: 'classique',
    obstacles: []
  },
  chicane: {
    id: 'chicane',
    obstacles: [
      { dx: 85, dy: 130 },
      { dx: -85, dy: -130 }
    ]
  },
  sentinelle: {
    id: 'sentinelle',
    // Sur l'axe (dx: 0), comme le roi et le kubb central : un tir tout droit
    // depuis le centre de la ligne de lancer les percute avant sa cible.
    obstacles: [
      { dx: 0, dy: 70 },
      { dx: 0, dy: -70 }
    ]
  }
};

/**
 * Vent (meteo), optionnel via un bouton au menu (off par defaut).
 *
 * Une force laterale constante, dans l'axe X du terrain (une brise
 * traversiere, independante de l'angle vise), s'ajoute a la vitesse du baton
 * a chaque pas de vol (MatchScene.update, meme decroissance frictionAir que
 * Baton.launch). Sens tire au hasard une seule fois par partie, jamais par
 * lancer.
 */
export const WIND = {
  /** Vitesse laterale gagnee par pas de simulation Matter (60 pas/s). */
  accelPerStep: 0.05,
  /**
   * Marge additionnelle sur le rayon de danger du roi (ai.ts), uniquement
   * quand le vent souffle. L'IA compense la derive attendue (ai.ts,
   * windCompensatedAngle), mais cette compensation reste une approximation
   * en ligne droite d'une trajectoire en realite courbee — cette marge
   * absorbe l'ecart residuel. Valeur issue d'un balayage en simulation
   * (scripts/scratchpad, trajectoire courbee reelle, pas le modele en
   * rayons droits de l'IA) : zero suicide du roi mesure avec cette marge,
   * sur des milliers de lancers simules a plusieurs forces de vent.
   */
  kingDangerMargin: 26
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
