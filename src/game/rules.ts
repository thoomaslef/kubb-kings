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
  kingRadius: 20,
  /**
   * Rayon de la "boule" (projectile de boutique, batons.ts shape:'boule') —
   * un corps Matter circulaire plutot que le rectangle allonge du baton.
   * Volontairement egal a batonWidth/2 : meme empan de contact qu'un coup
   * de baton bien centre, sans l'allonge que la rotation donne au baton
   * (cf. KING_DANGER_RADIUS dans ai.ts, qui n'a jamais connaissance de la
   * boule — l'IA reste toujours sur le baton de base).
   */
  ballRadius: 14
} as const;

/**
 * Terrains a obstacles.
 *
 * Chaque preset ajoute des rochers statiques, tous a la meme geometrie de
 * terrain (FIELD, KUBB_SPACING, hitboxes : rien de tout cela ne change) —
 * seuls des blocs supplementaires apparaissent, positionnes en decalage
 * (dx, dy) depuis le centre du terrain. Un rocher ne peut rien faire tomber
 * ni etre abattu : il fait juste rebondir le baton, comme une bande.
 *
 * "Colline" (hasHill) est different : pas un rocher, une zone circulaire de
 * friction accrue centree sur le terrain (comme le roi) — un tir qui la
 * traverse ressort plus lent qu'il n'y est entre, sans jamais rebondir ni
 * changer de trajectoire. Il faut donc y mettre plus de puissance pour
 * ressortir avec assez de vitesse. Cf. HILL_RADIUS/HILL_EXTRA_FRICTION.
 *
 * "Glace" et "Sable" sont differents encore : pas une zone localisee, tout
 * le terrain a une friction (et un rebond sur les bandes/rochers) modifies
 * pour la partie entiere — frictionMultiplier/restitutionMultiplier,
 * multiplicatifs sur BATON_BODY.frictionAir/restitution. "Sable" penalise en
 * plus la boule bien plus que le baton (frictionMultiplierBall) : une bille
 * s'enfonce dans le sable, un baton glisse dessus. "Sable" combine en plus 4
 * cactus (memes rochers qu'ailleurs, juste une autre texture — cf.
 * Obstacle.ts) avec cette friction/ce rebond modifies : premier preset a
 * cumuler les deux mecanismes, d'ou une verification IA dediee (voir
 * README, section "Terrains a obstacles").
 */
export type FieldPresetId = 'classique' | 'chicane' | 'sentinelle' | 'colline' | 'glace' | 'sable';

export interface FieldPreset {
  id: FieldPresetId;
  /** Decalages (dx, dy) depuis FIELD_CENTER_X/Y, en pixels de design. */
  obstacles: ReadonlyArray<{ dx: number; dy: number }>;
  /** true si ce preset a la zone de friction "colline" (toujours centree sur le terrain). */
  hasHill: boolean;
  /**
   * Multiplicateur sur BATON_BODY.frictionAir, pour tout le terrain (1 =
   * normal). S'applique en plus de HILL_EXTRA_FRICTION si hasHill est vrai
   * (les deux sont independants, meme si aucun preset ne les combine pour
   * l'instant).
   */
  frictionMultiplier: number;
  /**
   * Variante de frictionMultiplier pour la boule (batons.ts shape:'boule')
   * uniquement — absente = meme valeur que frictionMultiplier pour tous les
   * projectiles (baton comme boule).
   */
  frictionMultiplierBall?: number;
  /** Multiplicateur sur BATON_BODY.restitution (rebond aux bandes/rochers), pour tout le terrain (1 = normal). */
  restitutionMultiplier: number;
  /** Texture de sol (BootScene) dessinee sur tout le terrain — 'grass' par defaut. */
  groundTexture: 'grass' | 'ice' | 'sand';
}

/** Rayon d'un rocher, en pixels de design — un peu plus large que le roi. */
export const OBSTACLE_RADIUS = 22;

/** Rayon de la zone de friction de "Colline", en pixels de design, centree sur FIELD_CENTER. */
export const HILL_RADIUS = 130;
/**
 * frictionAir SUPPLEMENTAIRE a l'interieur de la colline, en plus de
 * BATON_BODY.frictionAir (0.015) — traverser tout le diametre (260px) coute
 * environ 0.012*260 = 3.1 de vitesse en plus a compenser, soit ~10% de jauge
 * de puissance en plus (THROW.maxSpeed = 30) pour un tir qui la traverse en
 * ligne droite. Applique par MatchScene (frictionAir du corps Matter du
 * baton, ajuste selon sa position) et par ai.ts (powerForDistance,
 * simulateWindFlight) — cf. leurs docblocks respectifs.
 */
export const HILL_EXTRA_FRICTION = 0.012;

/**
 * "Glace" : moitie moins de friction sur tout le terrain (baton comme
 * boule) — un tir va bien plus loin a puissance egale, il faut donc doser
 * plus finement. Rebond plus vif sur les bandes/rochers (restitution x1.7,
 * 0.35 -> ~0.6, reste sous 1 donc toujours amorti) : un tir qui les touche
 * repart avec plus d'energie qu'en temps normal.
 */
const ICE_FRICTION_MULTIPLIER = 0.5;
const ICE_RESTITUTION_MULTIPLIER = 1.7;

/**
 * "Sable" : plus de friction sur tout le terrain, et bien plus pour la
 * boule que pour le baton (elle s'enfonce, le baton glisse dessus) — le
 * meme ecart Precision/Controle qui distingue deja les deux projectiles
 * (batons.ts) devient donc un vrai choix de terrain. Rebond plus mou sur
 * les bandes/rochers (restitution x0.35, 0.35 -> ~0.12, proche de
 * l'amortissement d'un kubb) : un tir qui les touche y perd presque tout.
 */
const SAND_FRICTION_MULTIPLIER = 1.6;
const SAND_FRICTION_MULTIPLIER_BALL = 2.8;
const SAND_RESTITUTION_MULTIPLIER = 0.35;

// Libelles et indices : src/i18n/dictionaries.ts (terrain.<id>.label / .hint).
// Deblocage (niveau + achat) : src/game/shop.ts (SHOP_ITEMS, categorie
// 'terrain') — seul "classique" reste disponible d'office.
export const FIELD_PRESETS: Record<FieldPresetId, FieldPreset> = {
  classique: {
    id: 'classique',
    obstacles: [],
    hasHill: false,
    frictionMultiplier: 1,
    restitutionMultiplier: 1,
    groundTexture: 'grass'
  },
  chicane: {
    id: 'chicane',
    obstacles: [
      { dx: 85, dy: 130 },
      { dx: -85, dy: -130 }
    ],
    hasHill: false,
    frictionMultiplier: 1,
    restitutionMultiplier: 1,
    groundTexture: 'grass'
  },
  sentinelle: {
    id: 'sentinelle',
    // Sur l'axe (dx: 0), comme le roi et le kubb central : un tir tout droit
    // depuis le centre de la ligne de lancer les percute avant sa cible.
    obstacles: [
      { dx: 0, dy: 70 },
      { dx: 0, dy: -70 }
    ],
    hasHill: false,
    frictionMultiplier: 1,
    restitutionMultiplier: 1,
    groundTexture: 'grass'
  },
  colline: {
    id: 'colline',
    obstacles: [],
    hasHill: true,
    frictionMultiplier: 1,
    restitutionMultiplier: 1,
    groundTexture: 'grass'
  },
  glace: {
    id: 'glace',
    obstacles: [],
    hasHill: false,
    frictionMultiplier: ICE_FRICTION_MULTIPLIER,
    restitutionMultiplier: ICE_RESTITUTION_MULTIPLIER,
    groundTexture: 'ice'
  },
  sable: {
    id: 'sable',
    // 4 cactus, symetriques sur les deux axes a la fois (memes decalages que
    // "Chicane", dupliques dans les 4 cadrans) : contrairement a Chicane
    // (en S, hors axe) ou Sentinelle (sur l'axe), aucune ligne de lancer
    // n'est structurellement privilegiee.
    obstacles: [
      { dx: 85, dy: 130 },
      { dx: -85, dy: 130 },
      { dx: 85, dy: -130 },
      { dx: -85, dy: -130 }
    ],
    hasHill: false,
    frictionMultiplier: SAND_FRICTION_MULTIPLIER,
    frictionMultiplierBall: SAND_FRICTION_MULTIPLIER_BALL,
    restitutionMultiplier: SAND_RESTITUTION_MULTIPLIER,
    groundTexture: 'sand'
  }
};

/**
 * Vent (meteo), optionnel via un bouton au menu (off par defaut).
 *
 * Une acceleration constante s'ajoute a la vitesse du baton a chaque pas de
 * vol (MatchScene.update, meme decroissance frictionAir que Baton.launch),
 * dans l'une des 8 directions de la boussole, a l'une de 2 forces. Direction
 * ET force sont tirees au hasard une seule fois par partie (jamais par
 * lancer) et affichees clairement dans le HUD (boussole + libelle).
 */
export type WindDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export type WindForce = 1 | 2;

/** Etat du vent d'une partie : direction (boussole) et force (1 ou 2). */
export interface Wind {
  direction: WindDirection;
  force: WindForce;
}

/** Les 8 sens possibles, dans l'ordre de la boussole (pour un tirage au hasard ou un affichage). */
export const WIND_DIRECTIONS: readonly WindDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * Vecteur unitaire par sens, dans le repere du terrain (x vers l'est/la
 * droite, y vers le sud/le bas — Nord est donc y negatif). Les diagonales
 * sont normalisees (norme 1) pour que la force d'un vent diagonal ne soit
 * pas plus forte qu'un vent cardinal.
 */
const DIAG = Math.SQRT1_2;
export const WIND_UNIT_VECTORS: Record<WindDirection, { x: number; y: number }> = {
  N: { x: 0, y: -1 },
  NE: { x: DIAG, y: -DIAG },
  E: { x: 1, y: 0 },
  SE: { x: DIAG, y: DIAG },
  S: { x: 0, y: 1 },
  SW: { x: -DIAG, y: DIAG },
  W: { x: -1, y: 0 },
  NW: { x: -DIAG, y: -DIAG }
};

export const WIND = {
  /** Vitesse gagnee par pas de simulation Matter (60 pas/s), par unite de force (1 ou 2). */
  accelPerStepPerForce: 0.05
} as const;

/** Acceleration (x, y) appliquee au baton a chaque pas de vol pour ce vent. */
export function windAcceleration(wind: Wind): { x: number; y: number } {
  const unit = WIND_UNIT_VECTORS[wind.direction];
  const magnitude = WIND.accelPerStepPerForce * wind.force;
  return { x: unit.x * magnitude, y: unit.y * magnitude };
}

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
