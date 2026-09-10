import { BATON_BODY } from './physics/matterConfig';
import {
  AIM,
  FIELD_CENTER_X,
  FIELD_CENTER_Y,
  HITBOX,
  KNOCKDOWN_IMPACT_SPEED,
  MAX_AIM_DEVIATION_DEG,
  OBSTACLE_RADIUS,
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
 */
export function powerForDistance(distance: number, margin = 1.55): number {
  const needed = KNOCKDOWN_IMPACT_SPEED * margin + BATON_BODY.frictionAir * distance;
  return Math.max(AIM.minPower, Math.min(1, needed / THROW.maxSpeed));
}

/** Vitesse restante apres avoir parcouru `distance`, cf. powerForDistance. */
function speedAfter(power: number, distance: number): number {
  return THROW.maxSpeed * power - BATON_BODY.frictionAir * distance;
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
  windAccel: Point = NO_WIND_ACCEL
): FlightStep[] {
  const k = BATON_BODY.frictionAir;
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
    vx = vx * (1 - k) + windAccel.x;
    vy = vy * (1 - k) + windAccel.y;
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
  windAccel: Point
): number {
  let angle = naiveAngle;
  for (let pass = 0; pass < 2; pass += 1) {
    const path = simulateWindFlight(origin, angle, power, windAccel);
    const lateral = lateralOffsetAt(path, origin, naiveAngle, distance);
    angle += lateral / distance;
  }
  return angle;
}

/**
 * Rayons de collision vus par un baton en vol.
 *
 * Pour juger un impact on prend la demi-largeur du baton. Pour juger un DANGER
 * on prend sa demi-longueur : il tourne sur lui-meme, donc il peut accrocher
 * le roi bien plus loin que son axe ne le laisse croire.
 */
const KUBB_HIT_RADIUS = HITBOX.kubb / 2 + HITBOX.batonWidth / 2;
const KING_HIT_RADIUS = HITBOX.kingRadius + HITBOX.batonWidth / 2;
const KING_DANGER_RADIUS = HITBOX.kingRadius + HITBOX.batonLength / 2;
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
 * Echantillons pour le controle de securite roi COURBE sous le vent (voir
 * curvedKingDanger plus bas). Impair pour retomber exactement sur le tir
 * nominal en son centre, comme APPROACH_SAFETY_STEPS (decideApproachThrow,
 * plus bas) — meme raisonnement : aimError et deviation n'entrent dans la
 * simulation que par leur somme, donc un balayage LINEAIRE de cette somme
 * couvre exactement les memes extremes qu'une grille complete.
 */
const KING_WIND_SAFETY_STEPS = 151;
/**
 * Marge de securite ajoutee a KING_HIT_RADIUS pour ce seul controle courbe
 * (jamais pour le rendu ni la detection de contact reelle) : absorbe le
 * residu de discretisation de KING_WIND_SAFETY_STEPS et le pire cas de
 * puissance (powerError, applique apres coup par applyImprecision — d'ou la
 * puissance majoree utilisee ci-dessous, meme logique que safetyPower dans
 * decideApproachThrow). Valeur issue d'un balayage en simulation
 * (scripts/scratchpad, trajectoire courbee reelle) : zero suicide mesure
 * avec cette marge, aux 2 forces de vent et aux 8 directions.
 */
const KING_WIND_SAFETY_MARGIN = 60;

/**
 * Le tir (origine, angle, puissance) risque-t-il de froler le roi en
 * chemin, une fois le vent pris en compte ? Contrairement au controle en
 * ligne droite utilise pour les kubbs/rochers (firstObstacle), celui-ci
 * simule la VRAIE trajectoire COURBEE (simulateWindFlight) sur tout le cone
 * d'incertitude : sous un vent fort, une correction d'angle valable a la
 * distance de la cible peut laisser le baton passer bien plus pres du roi
 * qu'un modele en ligne droite ne le laisserait croire, si le roi se trouve
 * a mi-chemin d'une cible plus lointaine (ce que le seul angle central
 * corrige par windCompensatedAngle ne garantit pas).
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
  king: Point
): boolean {
  const maxOffset = profile.aimErrorDeg + MAX_AIM_DEVIATION_DEG;
  const safetyPower = Math.min(1, power * (1 + profile.powerErrorRatio));

  for (let s = 0; s < KING_WIND_SAFETY_STEPS; s += 1) {
    const offset = ((2 * s) / (KING_WIND_SAFETY_STEPS - 1) - 1) * maxOffset;
    const path = simulateWindFlight(origin, angle + offset * DEG, safetyPower, windAccel);
    for (const step of path) {
      const dist = Math.hypot(step.x - king.x, step.y - king.y);
      if (dist <= KING_HIT_RADIUS + KING_WIND_SAFETY_MARGIN) return true;
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

  // Le roi est un obstacle dans les deux cas : soit c'est la cible, soit c'est
  // le piege. Seul son rayon change.
  const obstacles: Obstacle[] = board.targets.map((p) => ({ p, radius: KUBB_HIT_RADIUS, kind: 'kubb' as const }));
  if (board.kingStanding) {
    if (aimingAtKing) {
      obstacles.push({ p: king, radius: KING_HIT_RADIUS, kind: 'king' as const });
    } else if (!windAccel) {
      // Sans vent, le controle en ligne droite ci-dessous suffit : aucune
      // courbure a rater. Avec vent, curvedKingDanger (plus bas, sur la VRAIE
      // trajectoire courbee) s'en charge a la place — un simple rayon
      // majore d'une marge ne suffit plus (voir sa documentation).
      obstacles.push({ p: king, radius: KING_DANGER_RADIUS, kind: 'king' as const });
    }
  }
  for (const p of board.obstacles ?? []) {
    obstacles.push({ p, radius: BLOCK_HIT_RADIUS, kind: 'block' as const });
  }

  const forward = board.direction === -1 ? -Math.PI / 2 : Math.PI / 2;
  const maxDelta = AIM.maxAngleDeg * DEG;
  const positions = board.ownStanding ? availableThrowPositions(board.ownStanding) : THROW_POSITIONS;

  const candidates: Candidate[] = [];

  for (const throwX of positions) {
    const origin: Point = { x: throwX, y: board.throwerY };

    for (const target of targets) {
      const distance = Math.hypot(target.x - origin.x, target.y - origin.y);
      const power = powerForDistance(distance);
      const naiveAngle = Math.atan2(target.y - origin.y, target.x - origin.x);
      // Vise en amont du vent quand il souffle : l'angle "naif" ne suffirait
      // qu'a atteindre la cible sans lui, jamais avec.
      const angle = windAccel ? windCompensatedAngle(origin, naiveAngle, power, distance, windAccel) : naiveAngle;
      if (Math.abs(wrapAngle(angle - forward)) > maxDelta) continue;

      if (windAccel && board.kingStanding && !aimingAtKing) {
        if (curvedKingDanger(origin, angle, power, profile, windAccel, king)) continue;
      }

      let knockdowns = 0;
      let shots = 0;
      let touchesKing = false;

      for (let a = 0; a < AIM_SAMPLES && !touchesKing; a += 1) {
        const aimError = ((2 * a) / (AIM_SAMPLES - 1) - 1) * profile.aimErrorDeg;

        for (let d = 0; d < DEVIATION_SAMPLES; d += 1) {
          const deviation = ((2 * d) / (DEVIATION_SAMPLES - 1) - 1) * MAX_AIM_DEVIATION_DEG;
          shots += 1;

          const hit = firstObstacle(origin, angle + (aimError + deviation) * DEG, obstacles);
          if (!hit) continue;

          if (hit.obstacle.kind === 'king' && !aimingAtKing) {
            touchesKing = true;
            break;
          }
          // Rocher percute avant la cible : tir gache, mais sans consequence
          // (contrairement au roi, il ne fait pas perdre la partie).
          if (hit.obstacle.kind === 'block') continue;
          // Un baton en fin de course rebondit sans rien renverser.
          if (speedAfter(power, hit.distance) >= KNOCKDOWN_IMPACT_SPEED) knockdowns += 1;
        }
      }

      if (touchesKing) continue;

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
        // Le lancer reellement execute peut recevoir jusqu'a +powerErrorRatio
        // de puissance en plus (imprecision du niveau, appliquee apres ce
        // controle) : un baton plus fort va plus loin sur la MEME droite, et
        // peut donc atteindre un point plus proche du roi que celui-ci n'a
        // jamais teste si on ne verifiait qu'avec la puissance nominale.
        const safetyPower = Math.min(1, power * (1 + profile.powerErrorRatio));

        const maxOffset = profile.aimErrorDeg + MAX_AIM_DEVIATION_DEG;
        let safe = true;
        let nominalPath: FlightStep[] | null = null;

        for (let s = 0; s < APPROACH_SAFETY_STEPS && safe; s += 1) {
          const offset = ((2 * s) / (APPROACH_SAFETY_STEPS - 1) - 1) * maxOffset;
          const path = simulateWindFlight(origin, angle + offset * DEG, safetyPower, windAccel);

          let closest = Infinity;
          for (const step of path) {
            const dist = Math.hypot(step.x - king.x, step.y - king.y);
            if (dist < closest) closest = dist;
          }
          if (closest <= KING_HIT_RADIUS + APPROACH_SAFETY_MARGIN) safe = false;

          if (offset === 0) nominalPath = simulateWindFlight(origin, angle, power, windAccel);
        }

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
