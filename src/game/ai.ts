import { BATON_BODY } from './physics/matterConfig';
import {
  AIM,
  FIELD_CENTER_X,
  FIELD_CENTER_Y,
  HILL_EXTRA_FRICTION,
  HILL_RADIUS,
  HITBOX,
  KNOCKDOWN_IMPACT_SPEED,
  MAX_AIM_DEVIATION_DEG,
  OBSTACLE_RADIUS,
  RIVER_FRICTION_MULTIPLIER,
  RIVER_HALF_WIDTH,
  THROW,
  THROW_POSITIONS,
  availableThrowPositions,
  windAcceleration,
  type Wind
} from './rules';

/**
 * Le cerveau de l'adversaire solo.
 *
 * Module volontairement pur : pas d'import Phaser, pas d'acces a la scene, pas
 * d'aleatoire non injecte. Il recoit une photo du plateau et rend un lancer.
 * On peut donc le simuler par milliers hors du navigateur — c'est ce qui permet
 * de verifier qu'un niveau "difficile" gagne vraiment plus souvent qu'un
 * niveau "facile", et surtout que l'IA ne se suicide pas sur le roi.
 *
 * L'IA joue avec exactement les memes contraintes que le joueur : meme ligne de
 * lancer, meme ouverture maximale, meme deviation aleatoire appliquee par
 * Baton.launch(). Elle ne triche pas — sa difficulte ne joue que sur la
 * precision de sa visee et sur son choix de cible.
 */

export type Difficulty = 'facile' | 'moyen' | 'difficile';

/**
 * Equipe tenue par l'IA en solo. Le joueur garde le bleu, qui commence :
 * on ne veut pas qu'une partie s'ouvre sur l'IA en train de reflechir.
 */
export const AI_TEAM = 'red' as const;

export interface AiProfile {
  /**
   * Erreur de visee propre a l'IA, en degres, EN PLUS de la deviation du jeu
   * (MAX_AIM_DEVIATION_DEG, actuellement +/-2.5 deg).
   *
   * Attention au calibrage : en dessous d'environ 2 deg ce reglage se noie
   * dans la deviation du jeu et cesse de se voir. Le seuil depend directement
   * de MAX_AIM_DEVIATION_DEG dans rules.ts — le rebalancer ici si on retouche
   * l'autre.
   */
  aimErrorDeg: number;
  /**
   * Erreur relative sur la puissance (0.2 = +/-20%).
   *
   * Meme remarque : sans effet en dessous de ~0.15, puis chute brutale — c'est
   * le seuil ou le baton arrive trop mou et rebondit sans rien renverser.
   */
  powerErrorRatio: number;
  /** Duree de "reflexion" avant de viser, en ms. */
  thinkMs: number;
}

/**
 * Les trois niveaux.
 *
 * Les valeurs ne sont pas choisies au jugé : elles sortent d'un balayage
 * parametre par parametre sur des milliers de matchs simules. Deux reglages
 * envisages au depart — piocher un coup au hasard plutot que le meilleur, et
 * ignorer son cone d'incertitude — se sont reveles strictement sans effet sur
 * le resultat, et ont ete retires plutot que gardes pour la forme.
 */
export const AI_PROFILES: Record<Difficulty, AiProfile> = {
  facile: {
    aimErrorDeg: 12,
    powerErrorRatio: 0.45,
    thinkMs: 500
  },
  moyen: {
    aimErrorDeg: 7,
    powerErrorRatio: 0.24,
    thinkMs: 650
  },
  difficile: {
    aimErrorDeg: 3.5,
    powerErrorRatio: 0.03,
    thinkMs: 850
  }
};

export interface Point {
  x: number;
  y: number;
}

/** Photo du plateau, du point de vue de l'IA. */
export interface AiBoard {
  /** Ligne de lancer de l'IA (son `throwerY`). */
  throwerY: number;
  /** Sens de lancer sur l'axe Y : -1 vers le haut, +1 vers le bas. */
  direction: -1 | 1;
  /** Kubbs adverses encore debout. */
  targets: Point[];
  /** true quand tous les kubbs adverses sont tombes : le roi devient legal. */
  kingTargetable: boolean;
  /** true tant que le roi est debout et donc dangereux a frole. */
  kingStanding: boolean;
  /**
   * Rochers du terrain choisi, s'il y en a. Ni cible ni danger de defaite —
   * juste un tir gache si on les percute, comme un baton trop court.
   */
  obstacles?: Point[];
  /**
   * Vent (direction + force), si la meteo est activee (absent sinon).
   * Cf. WIND/Wind dans rules.ts.
   */
  wind?: Wind;
  /**
   * Ses propres kubbs encore debout, `standing[i]` pour `THROW_POSITIONS[i]`
   * (rules.ts) : on ne peut plus lancer a l'aplomb d'un kubb tombe. Absent =
   * toutes les positions disponibles (comportement d'avant cette regle).
   */
  ownStanding?: readonly boolean[];
  /**
   * true sur le terrain "Colline" (rules.ts::FIELD_PRESETS) : une zone de
   * friction accrue centree sur le terrain, qu'il faut compenser en
   * puissance. Cf. powerForDistance/speedAfter/simulateWindFlight.
   */
  hasHill?: boolean;
  /**
   * true sur le terrain "Riviere" (rules.ts::FIELD_PRESETS) : une bande
   * horizontale centree sur le terrain (RIVER_HALF_WIDTH) qui REDUIT la
   * friction plutot que l'augmenter — le baton en ressort plus vite qu'un
   * trajet normal. Cf. powerForDistance/speedAfter/simulateWindFlight.
   */
  hasRiver?: boolean;
  /**
   * Multiplicateur de friction pour tout le terrain ("Glace"/"Sable"/"Boue",
   * rules.ts::FieldPreset.frictionMultiplier) — absent ou 1 = normal.
   * Toujours le multiplicateur "baton" du preset : l'IA reste toujours sur
   * le baton de base, jamais frictionMultiplierBall.
   */
  frictionMultiplier?: number;
}

export interface AiThrow {
  throwX: number;
  angle: number;
  power: number;
  /** Cible visee, pour le journal de debogage et les tests. */
  aimedAt: Point;
}

/** Source d'aleatoire injectable, pour rendre les tests reproductibles. */
export type Rng = () => number;

// --------------------------------------------------------------------- outils

const DEG = Math.PI / 180;

/** Ramene un ecart d'angle dans [-PI, PI]. */
function wrapAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Puissance necessaire pour arriver sur la cible en abattant encore.
 *
 * Matter applique frictionAir a chaque pas : v <- v * (1 - k). La distance
 * parcourue en n pas vaut v0 * (1 - (1-k)^n) / k, d'ou une vitesse restante
 * apres une distance d qui se simplifie en v(d) = v0 - k * d.
 * Il suffit donc de partir a `impact vise + k * d`.
 *
 * `hillCrossing` (terrain "Colline", rules.ts) : longueur du trajet qui
 * traverse la zone de friction accrue (0 hors de ce terrain, ou si le tir
 * ne la croise pas) — la meme identite s'applique par morceau (le
 * coefficient de friction est constant sur chaque segment), donc s'ajoute
 * simplement au terme de distance normal avec son propre coefficient
 * (HILL_EXTRA_FRICTION plutot que BATON_BODY.frictionAir).
 *
 * `frictionMultiplier` (terrains "Glace"/"Sable"/"Boue", rules.ts) : multiplicatif
 * sur BATON_BODY.frictionAir pour tout le trajet (1 = normal) — l'IA reste
 * toujours sur le baton de base, jamais la boule, donc toujours le
 * multiplicateur "baton" du preset (FieldPreset.frictionMultiplier), jamais
 * frictionMultiplierBall.
 *
 * `riverCrossing` (terrain "Riviere", rules.ts) : longueur du trajet qui
 * traverse la bande a friction reduite (0 hors de ce terrain, ou si le tir
 * ne la croise pas). Contrairement a `hillCrossing` (additif), la riviere
 * est MULTIPLICATIVE sur le coefficient normal — on "retire" donc la part
 * de friction normale epargnee sur ce segment plutot que d'ajouter un
 * terme : `distance - riverCrossing*(1-RIVER_FRICTION_MULTIPLIER)` est la
 * distance EFFECTIVE pour le calcul de friction habituel, exactement
 * equivalente a integrer un coefficient different par morceau.
 */
export function powerForDistance(
  distance: number,
  margin = 1.55,
  hillCrossing = 0,
  frictionMultiplier = 1,
  riverCrossing = 0
): number {
  const effectiveDistance = distance - riverCrossing * (1 - RIVER_FRICTION_MULTIPLIER);
  const needed =
    KNOCKDOWN_IMPACT_SPEED * margin +
    BATON_BODY.frictionAir * frictionMultiplier * effectiveDistance +
    HILL_EXTRA_FRICTION * hillCrossing;
  return Math.max(AIM.minPower, Math.min(1, needed / THROW.maxSpeed));
}

/** Vitesse restante apres avoir parcouru `distance`, cf. powerForDistance. */
function speedAfter(power: number, distance: number, hillCrossing = 0, frictionMultiplier = 1, riverCrossing = 0): number {
  const effectiveDistance = distance - riverCrossing * (1 - RIVER_FRICTION_MULTIPLIER);
  return (
    THROW.maxSpeed * power - BATON_BODY.frictionAir * frictionMultiplier * effectiveDistance - HILL_EXTRA_FRICTION * hillCrossing
  );
}

/**
 * Longueur du segment [origin, origin + (dx,dy)*rayLength] (dx,dy unitaire)
 * a l'interieur du disque de la colline (rayon HILL_RADIUS, centre du
 * terrain) — 0 si `hasHill` est faux, si le rayon est nul, ou si ce segment
 * ne croise pas le disque.
 */
function hillCrossingOnRay(origin: Point, dx: number, dy: number, rayLength: number, hasHill: boolean): number {
  if (!hasHill || rayLength <= 0) return 0;
  const ocx = FIELD_CENTER_X - origin.x;
  const ocy = FIELD_CENTER_Y - origin.y;
  const proj = ocx * dx + ocy * dy;
  const perp2 = ocx * ocx + ocy * ocy - proj * proj;
  if (perp2 >= HILL_RADIUS * HILL_RADIUS) return 0;
  const halfChord = Math.sqrt(HILL_RADIUS * HILL_RADIUS - perp2);
  const enter = Math.max(0, proj - halfChord);
  const exit = Math.min(rayLength, proj + halfChord);
  return Math.max(0, exit - enter);
}

/** Meme chose que hillCrossingOnRay, mais a partir d'une cible plutot que d'une direction. */
function hillCrossingToTarget(origin: Point, target: Point, distance: number, hasHill: boolean): number {
  if (!hasHill || distance <= 0) return 0;
  return hillCrossingOnRay(origin, (target.x - origin.x) / distance, (target.y - origin.y) / distance, distance, true);
}

/**
 * Longueur du segment [origin, origin + (0,dy)*rayLength] a l'interieur de
 * la bande "Riviere" (horizontale, RIVER_HALF_WIDTH de part et d'autre de
 * FIELD_CENTER_Y) — seul `dy` (composante verticale du vecteur unitaire de
 * direction) compte, une bande horizontale ne depend jamais de `dx`. Meme
 * structure que hillCrossingOnRay, geometrie de bande plutot que de cercle
 * (intersection lineaire, pas de quadratique a resoudre).
 */
function riverCrossingOnRay(origin: Point, dy: number, rayLength: number, hasRiver: boolean): number {
  if (!hasRiver || rayLength <= 0) return 0;
  const bandTop = FIELD_CENTER_Y - RIVER_HALF_WIDTH;
  const bandBottom = FIELD_CENTER_Y + RIVER_HALF_WIDTH;
  // Rayon (quasi) horizontal : entierement dans la bande, ou entierement hors.
  if (Math.abs(dy) < 1e-9) {
    return origin.y >= bandTop && origin.y <= bandBottom ? rayLength : 0;
  }
  const sEnter = (bandTop - origin.y) / dy;
  const sExit = (bandBottom - origin.y) / dy;
  const enter = Math.max(0, Math.min(sEnter, sExit));
  const exit = Math.min(rayLength, Math.max(sEnter, sExit));
  return Math.max(0, exit - enter);
}

/** Meme chose que riverCrossingOnRay, mais a partir d'une cible plutot que d'une direction. */
function riverCrossingToTarget(origin: Point, target: Point, distance: number, hasRiver: boolean): number {
  if (!hasRiver || distance <= 0) return 0;
  return riverCrossingOnRay(origin, (target.y - origin.y) / distance, distance, true);
}

// ---------------------------------------------------------------------- vent

export interface FlightStep extends Point {
  /** Vitesse a ce point (memes unites que Baton.speed), pour juger un impact. */
  speed: number;
}

/** Acceleration nulle : raccourci pour simuler un vol sans vent. */
const NO_WIND_ACCEL = { x: 0, y: 0 };

/**
 * Vole en repere-monde (x, y) avec la meme decroissance frictionAir et la
 * meme acceleration de vent, pas a pas, que le jeu reel (Baton.launch pour la
 * vitesse initiale, MatchScene.update pour l'increment de vent a chaque pas).
 * `windAccel` est un vecteur (x, y) — cf. windAcceleration() dans rules.ts —
 * pas juste une derive laterale : le vent peut souffler dans n'importe laquelle
 * des 8 directions de la boussole, y compris dans l'axe du lancer.
 * Renvoie la trajectoire ENTIERE (pas juste le point final) : la verification
 * de securite a besoin de savoir si le baton passe pres du roi en COURS de
 * route, une derive pouvant l'en rapprocher avant meme d'atteindre la
 * distance visee.
 */
export function simulateWindFlight(
  origin: Point,
  angle: number,
  power: number,
  windAccel: Point = NO_WIND_ACCEL,
  hasHill = false,
  frictionMultiplier = 1,
  hasRiver = false
): FlightStep[] {
  const k = BATON_BODY.frictionAir * frictionMultiplier;
  let vx = Math.cos(angle) * THROW.maxSpeed * power;
  let vy = Math.sin(angle) * THROW.maxSpeed * power;
  let x = origin.x;
  let y = origin.y;

  const path: FlightStep[] = [{ x, y, speed: Math.hypot(vx, vy) }];
  // Sans vent, v0 max / k vaut environ 2000 px (plus que la diagonale du
  // terrain) : le baton repasse toujours sous THROW.restSpeed bien avant
  // MAX_STEPS. Avec un vent dont la composante perpendiculaire a une vitesse
  // d'equilibre (accel/k) superieure a restSpeed, en revanche, la vitesse ne
  // repasse JAMAIS sous ce seuil — imiter le seul filet de securite du jeu
  // reel pour un tir qui ne s'arrete jamais de lui-meme (MatchScene.update :
  // flightMs >= THROW.maxFlightMs cloture le tour de force) est donc
  // essentiel, pas juste une optimisation : sans lui, un vent fort ferait
  // vagabonder la simulation jusqu'a MAX_STEPS avec une derive sans rapport
  // avec ce qui se passe reellement en jeu.
  const maxSteps = Math.ceil(THROW.maxFlightMs / (1000 / 60));
  for (let i = 0; i < maxSteps; i += 1) {
    // "Colline" (rules.ts) : friction supplementaire tant que le baton est
    // dans la zone, evaluee a sa position en DEBUT de pas — meme convention
    // que MatchScene (frictionAir ajuste selon la position courante).
    const insideHill = hasHill && Math.hypot(x - FIELD_CENTER_X, y - FIELD_CENTER_Y) <= HILL_RADIUS;
    // "Riviere" : friction MULTIPLIEE (jamais ajoutee, jamais negative — cf.
    // RIVER_FRICTION_MULTIPLIER) tant que le baton est dans la bande.
    const insideRiver = hasRiver && y >= FIELD_CENTER_Y - RIVER_HALF_WIDTH && y <= FIELD_CENTER_Y + RIVER_HALF_WIDTH;
    const kEffective = (insideHill ? k + HILL_EXTRA_FRICTION : k) * (insideRiver ? RIVER_FRICTION_MULTIPLIER : 1);
    vx = vx * (1 - kEffective) + windAccel.x;
    vy = vy * (1 - kEffective) + windAccel.y;
    x += vx;
    y += vy;
    const speed = Math.hypot(vx, vy);
    path.push({ x, y, speed });
    if (speed < THROW.restSpeed) break;
  }
  return path;
}

/**
 * Derive laterale (signee) d'une trajectoire par rapport a un axe vise
 * d'origine, au moment ou l'avancee le long de cet axe atteint `distance`.
 * Positive quand la trajectoire a devie vers la gauche de l'axe (sens
 * trigonometrique), negative vers la droite.
 */
function lateralOffsetAt(path: Point[], origin: Point, axisAngle: number, distance: number): number {
  const ux = Math.cos(axisAngle);
  const uy = Math.sin(axisAngle);

  for (const p of path) {
    const dx = p.x - origin.x;
    const dy = p.y - origin.y;
    const s = dx * ux + dy * uy;
    if (s >= distance) return dx * uy - dy * ux;
  }
  const last = path[path.length - 1];
  return (last.x - origin.x) * uy - (last.y - origin.y) * ux;
}

/**
 * Angle a viser pour qu'un tir souffle par le vent arrive quand meme sur sa
 * cible : simule le vol a l'angle naif, mesure la derive laterale a la
 * distance visee, corrige d'autant. Deux passes — le vent est une
 * perturbation modeste face a la distance, une seule correction suffirait
 * presque toujours, la seconde essuie le reste.
 */
function windCompensatedAngle(
  origin: Point,
  naiveAngle: number,
  power: number,
  distance: number,
  windAccel: Point,
  hasHill: boolean,
  frictionMultiplier: number,
  hasRiver: boolean
): number {
  let angle = naiveAngle;
  for (let pass = 0; pass < 2; pass += 1) {
    const path = simulateWindFlight(origin, angle, power, windAccel, hasHill, frictionMultiplier, hasRiver);
    const lateral = lateralOffsetAt(path, origin, naiveAngle, distance);
    angle += lateral / distance;
  }
  return angle;
}

/** Rayons de collision vus par un baton en vol (demi-largeur, l'empan de contact reel). */
const KUBB_HIT_RADIUS = HITBOX.kubb / 2 + HITBOX.batonWidth / 2;
const KING_HIT_RADIUS = HITBOX.kingRadius + HITBOX.batonWidth / 2;
const BLOCK_HIT_RADIUS = OBSTACLE_RADIUS + HITBOX.batonWidth / 2;

interface Obstacle {
  p: Point;
  radius: number;
  /** 'block' : un rocher — jamais une cible, jamais un motif de defaite. */
  kind: 'kubb' | 'king' | 'block';
}

/** Distance parcourue avant d'entrer dans l'obstacle, ou null s'il est manque. */
function rayHit(origin: Point, dx: number, dy: number, o: Obstacle): number | null {
  const along = (o.p.x - origin.x) * dx + (o.p.y - origin.y) * dy;
  if (along <= 0) return null;

  const perp = Math.hypot(origin.x + dx * along - o.p.x, origin.y + dy * along - o.p.y);
  if (perp > o.radius) return null;

  return along - Math.sqrt(o.radius * o.radius - perp * perp);
}

/**
 * Echantillons pour le controle de securite roi (voir curvedKingDanger plus
 * bas — utilise TOUJOURS, avec ou sans vent, cf. son propre docblock).
 * Impair pour retomber exactement sur le tir nominal en son centre, comme
 * APPROACH_SAFETY_STEPS (decideApproachThrow, plus bas) — meme raisonnement :
 * aimError et deviation n'entrent dans la simulation que par leur somme,
 * donc un balayage LINEAIRE de cette somme couvre exactement les memes
 * extremes qu'une grille complete.
 */
const KING_WIND_SAFETY_STEPS = 151;
/**
 * Marge de securite ajoutee a KING_HIT_RADIUS pour ce seul controle (jamais
 * pour le rendu ni la detection de contact reelle) : absorbe le residu de
 * discretisation de KING_WIND_SAFETY_STEPS. Valeur issue d'un balayage en
 * simulation (scripts/scratchpad, trajectoire courbee reelle) : zero suicide
 * mesure avec cette marge, aux 2 forces de vent et aux 8 directions.
 */
const KING_WIND_SAFETY_MARGIN = 60;

/**
 * Le tir (origine, angle, puissance) risque-t-il de froler le roi en
 * chemin ? Simule la VRAIE trajectoire (simulateWindFlight — courbee sous le
 * vent, ou simple ligne decelerant par friction si `windAccel` vaut
 * NO_WIND_ACCEL) sur tout le cone d'incertitude, TOUJOURS, que le vent
 * souffle ou non : sous un vent fort, une correction d'angle valable a la
 * distance de la cible peut laisser le baton passer bien plus pres du roi
 * qu'un modele en ligne droite ne le laisserait croire, si le roi se trouve
 * a mi-chemin d'une cible plus lointaine (ce que le seul angle central
 * corrige par windCompensatedAngle ne garantit pas) — et meme SANS vent, un
 * simple test geometrique en ligne droite (firstObstacle, comme pour les
 * kubbs/rochers/cactus) se laisse masquer par le premier obstacle croise sur
 * le chemin : un rocher/cactus juste avant le roi le rendait invisible a ce
 * controle, alors qu'un baton qui les heurte rebondit — il ne s'arrete pas
 * net, et peut tres bien continuer vers le roi ensuite (bug reel trouve par
 * la simulation lors de l'ajout des cactus sur "Sable", cf. README). Cette
 * fonction ignore volontairement rochers/cactus/kubbs : rien ne peut donc
 * jamais masquer un danger roi.
 *
 * Pas de pre-filtre en ligne droite ici (tente puis abandonne : sous un vent
 * fort, un tir faible peut derriver de plusieurs centaines de pixels sur
 * toute la duree de vol — voir simulateWindFlight — ce qui rend un rayon de
 * pre-filtre a la fois couteux a bien dimensionner et peu selectif sur un
 * terrain de cette taille). Le cout reste borne : simulateWindFlight
 * s'arrete lui-meme a THROW.maxFlightMs, jamais plus.
 */
function curvedKingDanger(
  origin: Point,
  angle: number,
  power: number,
  profile: AiProfile,
  windAccel: Point,
  king: Point,
  hasHill: boolean,
  frictionMultiplier: number,
  hasRiver: boolean
): boolean {
  const maxOffset = profile.aimErrorDeg + MAX_AIM_DEVIATION_DEG;
  // Le lancer reellement execute peut recevoir jusqu'a +-powerErrorRatio de
  // puissance (applyImprecision, applique APRES ce controle) : un baton plus
  // faible reste plus longtemps expose au vent avant de croiser le roi, ce
  // qui peut le rapprocher davantage qu'un baton plus fort (qui, lui, quitte
  // la zone plus vite) — surtout sur un terrain a friction reduite (Glace,
  // ou "Riviere" ponctuellement). Le pire cas n'est donc pas toujours la
  // puissance haute : les DEUX bornes doivent etre testees.
  const powerHigh = Math.min(1, power * (1 + profile.powerErrorRatio));
  const powerLow = Math.max(AIM.minPower, power * (1 - profile.powerErrorRatio));

  for (const safetyPower of [powerLow, powerHigh]) {
    for (let s = 0; s < KING_WIND_SAFETY_STEPS; s += 1) {
      const offset = ((2 * s) / (KING_WIND_SAFETY_STEPS - 1) - 1) * maxOffset;
      const path = simulateWindFlight(origin, angle + offset * DEG, safetyPower, windAccel, hasHill, frictionMultiplier, hasRiver);
      for (const step of path) {
        const dist = Math.hypot(step.x - king.x, step.y - king.y);
        if (dist <= KING_HIT_RADIUS + KING_WIND_SAFETY_MARGIN) return true;
      }
    }
  }
  return false;
}

/** Premier obstacle rencontre le long d'un tir, ou null. */
function firstObstacle(
  origin: Point,
  angle: number,
  obstacles: Obstacle[]
): { obstacle: Obstacle; distance: number } | null {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  let best: { obstacle: Obstacle; distance: number } | null = null;
  for (const o of obstacles) {
    const distance = rayHit(origin, dx, dy, o);
    if (distance !== null && (!best || distance < best.distance)) best = { obstacle: o, distance };
  }
  return best;
}

// -------------------------------------------------------------------- decision

/**
 * Echantillons par source d'erreur. On balaie les DEUX independamment plutot
 * qu'un cone unique : la somme de deux tirages uniformes n'est pas uniforme,
 * elle se concentre au centre. Traiter leur somme comme un cone plat
 * surestimait les bords — au point de faire croire qu'une visee large valait
 * mieux qu'une visee juste.
 */
const AIM_SAMPLES = 5;
const DEVIATION_SAMPLES = 5;

interface Candidate extends AiThrow {
  score: number;
}

/**
 * Choisit un lancer : une position sur la ligne, un angle et une puissance.
 *
 * Pour chaque couple (position, cible) on balaie le cone d'incertitude — erreur
 * propre de l'IA plus deviation du jeu — et on compte dans quelle proportion
 * des cas le baton finit par renverser quelque chose, en tenant compte de la
 * vitesse qu'il lui restera a l'impact.
 *
 * Un tir dont NE SERAIT-CE QU'UNE direction du cone touche le roi est rejete
 * tant que le roi n'est pas une cible legale : le perdre coute la partie, alors
 * qu'un tour gache ne coute qu'un tour. Si plus rien ne passe, on se rabat sur
 * `safeThrow`.
 */
export function decideThrow(board: AiBoard, profile: AiProfile, rng: Rng = Math.random): AiThrow {
  const king: Point = { x: FIELD_CENTER_X, y: FIELD_CENTER_Y };
  const aimingAtKing = board.kingTargetable;
  const targets = aimingAtKing ? [king] : board.targets;
  if (targets.length === 0) return safeThrow(board, rng);

  const windAccel = board.wind ? windAcceleration(board.wind) : null;

  // Le roi n'entre dans cette liste QUE quand c'est la cible visee (le piege
  // est gere a part, juste plus bas, sur TOUTE trajectoire qu'elle soit
  // courbee par le vent ou non). Le mettre ici pour le cas "piege" melangeait
  // sa detection avec celle des rochers/cactus : un rayon qui frole le roi
  // mais croise un obstacle AVANT lui se voyait alors compte "sans danger"
  // (firstObstacle ne renvoie que le PREMIER obstacle croise) — alors qu'un
  // baton qui heurte un rocher/cactus rebondit, il ne s'arrete pas net, et
  // peut tres bien continuer vers le roi ensuite. Cf. curvedKingDanger.
  const obstacles: Obstacle[] = board.targets.map((p) => ({ p, radius: KUBB_HIT_RADIUS, kind: 'kubb' as const }));
  if (board.kingStanding && aimingAtKing) {
    obstacles.push({ p: king, radius: KING_HIT_RADIUS, kind: 'king' as const });
  }
  for (const p of board.obstacles ?? []) {
    obstacles.push({ p, radius: BLOCK_HIT_RADIUS, kind: 'block' as const });
  }

  const forward = board.direction === -1 ? -Math.PI / 2 : Math.PI / 2;
  const maxDelta = AIM.maxAngleDeg * DEG;
  const positions = board.ownStanding ? availableThrowPositions(board.ownStanding) : THROW_POSITIONS;
  // L'IA reste toujours sur le baton de base : toujours le multiplicateur
  // "baton" du preset ("Glace"/"Sable", rules.ts), jamais frictionMultiplierBall.
  const frictionMultiplier = board.frictionMultiplier ?? 1;

  const candidates: Candidate[] = [];

  for (const throwX of positions) {
    const origin: Point = { x: throwX, y: board.throwerY };

    for (const target of targets) {
      const distance = Math.hypot(target.x - origin.x, target.y - origin.y);
      // "Colline" (rules.ts) : puissance majoree pour compenser la friction
      // supplementaire sur la portion du trajet qui la traverse (0 hors de
      // ce terrain, ou si la ligne droite vers cette cible ne la croise pas).
      const hillCrossing = hillCrossingToTarget(origin, target, distance, !!board.hasHill);
      const riverCrossing = riverCrossingToTarget(origin, target, distance, !!board.hasRiver);
      const power = powerForDistance(distance, undefined, hillCrossing, frictionMultiplier, riverCrossing);
      const naiveAngle = Math.atan2(target.y - origin.y, target.x - origin.x);
      // Vise en amont du vent quand il souffle : l'angle "naif" ne suffirait
      // qu'a atteindre la cible sans lui, jamais avec.
      const angle = windAccel
        ? windCompensatedAngle(origin, naiveAngle, power, distance, windAccel, !!board.hasHill, frictionMultiplier, !!board.hasRiver)
        : naiveAngle;
      if (Math.abs(wrapAngle(angle - forward)) > maxDelta) continue;

      // Verifie TOUJOURS la vraie trajectoire (courbee sous le vent, droite
      // sinon — simulateWindFlight avec NO_WIND_ACCEL degenere exactement en
      // ligne droite decelerant par friction) : independant de tout obstacle
      // rocher/cactus/kubb sur le chemin, donc jamais masque par eux (cf.
      // commentaire plus haut).
      if (board.kingStanding && !aimingAtKing) {
        const danger = curvedKingDanger(
          origin,
          angle,
          power,
          profile,
          windAccel ?? NO_WIND_ACCEL,
          king,
          !!board.hasHill,
          frictionMultiplier,
          !!board.hasRiver
        );
        if (danger) continue;
      }

      let knockdowns = 0;
      let shots = 0;

      for (let a = 0; a < AIM_SAMPLES; a += 1) {
        const aimError = ((2 * a) / (AIM_SAMPLES - 1) - 1) * profile.aimErrorDeg;

        for (let d = 0; d < DEVIATION_SAMPLES; d += 1) {
          const deviation = ((2 * d) / (DEVIATION_SAMPLES - 1) - 1) * MAX_AIM_DEVIATION_DEG;
          shots += 1;

          const sampleAngle = angle + (aimError + deviation) * DEG;
          const hit = firstObstacle(origin, sampleAngle, obstacles);
          if (!hit) continue;

          // Rocher/cactus percute avant la cible : tir gache, mais sans
          // consequence (contrairement au roi, il ne fait pas perdre la
          // partie — et sa propre securite est verifiee a part, ci-dessus).
          if (hit.obstacle.kind === 'block') continue;
          // Un baton en fin de course rebondit sans rien renverser. La
          // traversee de la colline/riviere (le cas echeant) se recalcule
          // pour ce rayon precis, pas pour l'axe nominal — l'angle jitter
          // d'un echantillon peut lui faire manquer ou au contraire
          // traverser la zone que le rayon nominal visait.
          const sampleHillCrossing = board.hasHill
            ? hillCrossingOnRay(origin, Math.cos(sampleAngle), Math.sin(sampleAngle), hit.distance, true)
            : 0;
          const sampleRiverCrossing = board.hasRiver ? riverCrossingOnRay(origin, Math.sin(sampleAngle), hit.distance, true) : 0;
          if (
            speedAfter(power, hit.distance, sampleHillCrossing, frictionMultiplier, sampleRiverCrossing) >=
            KNOCKDOWN_IMPACT_SPEED
          )
            knockdowns += 1;
        }
      }

      // Proportion des tirs du cone qui renversent effectivement quelque chose.
      const reliability = knockdowns / shots;
      const score = reliability * 10 - distance / 1000 + rng() * 0.01;

      candidates.push({ throwX, angle, power, aimedAt: target, score });
    }
  }

  if (candidates.length === 0) return safeThrow(board, rng);

  candidates.sort((a, b) => b.score - a.score);
  return applyImprecision(candidates[0], profile, rng);
}

/** Ajoute l'erreur de visee et de dosage propres au niveau de difficulte. */
function applyImprecision(shot: Candidate, profile: AiProfile, rng: Rng): AiThrow {
  const aimError = (rng() * 2 - 1) * profile.aimErrorDeg * DEG;
  const powerError = 1 + (rng() * 2 - 1) * profile.powerErrorRatio;

  return {
    throwX: shot.throwX,
    angle: shot.angle + aimError,
    power: Math.max(AIM.minPower, Math.min(1, shot.power * powerError)),
    aimedAt: shot.aimedAt
  };
}

/**
 * Lancer de repli, quand aucune cible n'est atteignable sans risquer le roi :
 * on tire mollement vers un cote, pour perdre le tour sans perdre la partie.
 * C'est volontairement mauvais — mais toucher le roi trop tot serait pire.
 */
export function safeThrow(board: AiBoard, rng: Rng = Math.random): AiThrow {
  const forward = board.direction === -1 ? -Math.PI / 2 : Math.PI / 2;
  const positions = board.ownStanding ? availableThrowPositions(board.ownStanding) : THROW_POSITIONS;
  // -1 : on se place a gauche et on tire encore plus a gauche. +1 : l'inverse.
  const side = rng() < 0.5 ? -1 : 1;
  const throwX = side < 0 ? positions[0] : positions[positions.length - 1];

  // On s'ecarte franchement de l'axe : le roi se tient au centre.
  const angle = forward - side * AIM.maxAngleDeg * 0.8 * DEG;
  const power = AIM.minPower * 2;

  return {
    throwX,
    angle,
    power,
    aimedAt: { x: throwX + Math.cos(angle) * 200, y: board.throwerY + Math.sin(angle) * 200 }
  };
}

// ------------------------------------------------------------ tir d'ouverture

/** Photo du plateau pour le tir d'ouverture : ni kubb ni victoire en jeu, juste le roi a approcher. */
export interface ApproachBoard {
  throwerY: number;
  direction: -1 | 1;
  /** Rochers du terrain choisi, s'il y en a — un tir qui les percute est gache. */
  obstacles?: Point[];
  wind?: Wind;
  /** true sur le terrain "Colline" — cf. AiBoard.hasHill. */
  hasHill?: boolean;
  /** true sur le terrain "Riviere" — cf. AiBoard.hasRiver. */
  hasRiver?: boolean;
  /** Multiplicateur de friction du terrain — cf. AiBoard.frictionMultiplier. */
  frictionMultiplier?: number;
}

const APPROACH_ANGLE_STEPS = 11;
const APPROACH_POWER_STEPS = 6;
/**
 * Echantillons de securite verifies sur chaque candidat. L'erreur IA et la
 * deviation du jeu n'entrent JAMAIS dans la simulation autrement que par
 * leur somme (angle + (aimError + deviation)), donc balayer lineairement
 * cette somme de -max a +max couvre exactement les memes extremes qu'une
 * grille (aimError x deviation) complete, pour une fraction du cout. Impair
 * pour retomber exactement sur le tir nominal (offset 0) en son centre —
 * c'est cette trajectoire-la qui sert a estimer le point d'arret.
 *
 * Un balayage reste discret : entre deux echantillons, la distance au roi
 * peut descendre plus bas que ce qui a ete mesure. Comme ce tir cherche
 * DELIBEREMENT le candidat le plus proche du roi qui passe le test, il finit
 * presque toujours pile a la limite de ce que le balayage a verifie — c'est
 * exactement la ou un tel trou se paie le plus cher. APPROACH_SAFETY_MARGIN
 * (plus bas) absorbe cet ecart, mesure par simulation (scripts/scratchpad).
 */
const APPROACH_SAFETY_STEPS = 61;
/**
 * Marge de securite ajoutee a KING_HIT_RADIUS pour ce seul controle interne
 * (jamais pour le rendu ni la detection de contact reelle, qui restent sur
 * KING_HIT_RADIUS) : absorbe le trou residuel entre deux echantillons de
 * APPROACH_SAFETY_STEPS (le pire cas de powerError, lui, est verifie a part
 * via safetyPower plus bas — sans cela un tir juste assez faible pour ne
 * jamais approcher le roi passait le controle, puis touchait bel et bien
 * une fois renforce par l'imprecision du niveau). Valeur issue d'un
 * balayage en simulation (scripts/scratchpad) : sans elle,
 * le tir le plus proche autorise touchait encore le roi dans plusieurs % des
 * cas (niveaux faciles/moyens, grand cone d'erreur) ; avec elle, ce taux
 * retombe a un niveau residuel juge acceptable pour ce mini-jeu non decisif
 * (contrairement a decideThrow, toucher le roi ici ne perd la partie que si
 * l'adversaire ne le touche pas aussi).
 */
const APPROACH_SAFETY_MARGIN = 45;

interface ApproachCandidate {
  throwX: number;
  angle: number;
  power: number;
  restDistance: number;
}

/**
 * Lancer du tir d'ouverture, qui determine qui commence la partie : chaque
 * equipe tire une fois vers le roi, celle qui l'approche le plus SANS le
 * toucher (meme un frolement disqualifie, cf. MatchScene::onCollisionStart)
 * commence. Contrairement a decideThrow il n'y a ici ni kubb ni defaite
 * immediate en jeu — seule compte la distance finale d'arret du baton au
 * roi, tant que ni lui ni son cone d'incertitude ne l'a touche en chemin.
 *
 * Balaie position x angle x puissance, rejette tout candidat dont le cone
 * d'incertitude (erreur IA + deviation du jeu, comme decideThrow) passe a
 * portee du roi a un instant quelconque de sa trajectoire COURBEE reelle
 * (simulateWindFlight, pas une approximation en ligne droite), puis retient
 * parmi les candidats surs celui dont le point d'arret nominal est le plus
 * proche du roi.
 */
export function decideApproachThrow(board: ApproachBoard, profile: AiProfile, rng: Rng = Math.random): AiThrow {
  const king: Point = { x: FIELD_CENTER_X, y: FIELD_CENTER_Y };
  const forward = board.direction === -1 ? -Math.PI / 2 : Math.PI / 2;
  const maxDelta = AIM.maxAngleDeg * DEG;
  const windAccel = board.wind ? windAcceleration(board.wind) : NO_WIND_ACCEL;
  const rockObstacles: Obstacle[] = (board.obstacles ?? []).map((p) => ({
    p,
    radius: BLOCK_HIT_RADIUS,
    kind: 'block' as const
  }));

  const candidates: ApproachCandidate[] = [];

  for (const throwX of THROW_POSITIONS) {
    const origin: Point = { x: throwX, y: board.throwerY };

    for (let ai = 0; ai < APPROACH_ANGLE_STEPS; ai += 1) {
      const angle = forward + ((2 * ai) / (APPROACH_ANGLE_STEPS - 1) - 1) * maxDelta;

      // Un rocher sur le chemin rend le point d'arret imprevisible (les
      // rebonds ne sont pas simules ici) : ce candidat est ecarte, comme un
      // tir gache dans decideThrow.
      if (firstObstacle(origin, angle, rockObstacles) !== null) continue;

      for (let pi = 0; pi < APPROACH_POWER_STEPS; pi += 1) {
        const power = AIM.minPower + ((1 - AIM.minPower) * pi) / (APPROACH_POWER_STEPS - 1);
        // Le lancer reellement execute peut recevoir jusqu'a +-powerErrorRatio
        // de puissance (imprecision du niveau, appliquee apres ce controle).
        // Un baton plus fort va plus loin sur la MEME droite ; mais un baton
        // plus faible reste plus longtemps expose au vent avant de croiser le
        // roi, ce qui peut le rapprocher davantage (surtout sur un terrain a
        // friction reduite) — les DEUX bornes doivent donc etre testees, pas
        // seulement la haute.
        const powerHigh = Math.min(1, power * (1 + profile.powerErrorRatio));
        const powerLow = Math.max(AIM.minPower, power * (1 - profile.powerErrorRatio));

        const maxOffset = profile.aimErrorDeg + MAX_AIM_DEVIATION_DEG;
        let safe = true;
        let nominalPath: FlightStep[] | null = null;

        for (const safetyPower of [powerLow, powerHigh]) {
          for (let s = 0; s < APPROACH_SAFETY_STEPS && safe; s += 1) {
            const offset = ((2 * s) / (APPROACH_SAFETY_STEPS - 1) - 1) * maxOffset;
            const path = simulateWindFlight(
              origin,
              angle + offset * DEG,
              safetyPower,
              windAccel,
              !!board.hasHill,
              board.frictionMultiplier ?? 1,
              !!board.hasRiver
            );

            let closest = Infinity;
            for (const step of path) {
              const dist = Math.hypot(step.x - king.x, step.y - king.y);
              if (dist < closest) closest = dist;
            }
            if (closest <= KING_HIT_RADIUS + APPROACH_SAFETY_MARGIN) safe = false;
          }
        }
        if (safe)
          nominalPath = simulateWindFlight(
            origin,
            angle,
            power,
            windAccel,
            !!board.hasHill,
            board.frictionMultiplier ?? 1,
            !!board.hasRiver
          );

        if (!safe || !nominalPath) continue;

        const last = nominalPath[nominalPath.length - 1];
        candidates.push({ throwX, angle, power, restDistance: Math.hypot(last.x - king.x, last.y - king.y) });
      }
    }
  }

  if (candidates.length === 0) {
    // Repli : rien n'est juge sur sur toutes les positions/angles/puissances
    // essayees — on s'ecarte franchement, comme safeThrow, garanti de manquer
    // le roi (mais loin de lui : un tir d'ouverture perdu d'avance).
    const side = rng() < 0.5 ? -1 : 1;
    const throwX = side < 0 ? THROW_POSITIONS[0] : THROW_POSITIONS[THROW_POSITIONS.length - 1];
    const angle = forward - side * AIM.maxAngleDeg * 0.8 * DEG;
    const power = AIM.minPower * 2;
    return {
      throwX,
      angle,
      power,
      aimedAt: { x: throwX + Math.cos(angle) * 200, y: board.throwerY + Math.sin(angle) * 200 }
    };
  }

  candidates.sort((a, b) => a.restDistance - b.restDistance);
  const best = candidates[0];

  const aimError = (rng() * 2 - 1) * profile.aimErrorDeg * DEG;
  const powerError = 1 + (rng() * 2 - 1) * profile.powerErrorRatio;
  return {
    throwX: best.throwX,
    angle: best.angle + aimError,
    power: Math.max(AIM.minPower, Math.min(1, best.power * powerError)),
    aimedAt: king
  };
}
