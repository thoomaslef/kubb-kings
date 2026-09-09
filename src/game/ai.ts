import { BATON_BODY } from './physics/matterConfig';
import {
  AIM,
  FIELD,
  FIELD_CENTER_X,
  FIELD_CENTER_Y,
  HITBOX,
  KNOCKDOWN_IMPACT_SPEED,
  MAX_AIM_DEVIATION_DEG,
  OBSTACLE_RADIUS,
  THROW,
  THROW_LINE_MARGIN,
  WIND
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
  label: string;
  /** Ce que le joueur lit dans le menu. */
  hint: string;
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
    label: 'Facile',
    hint: 'Vise large, dose au hasard',
    aimErrorDeg: 12,
    powerErrorRatio: 0.45,
    thinkMs: 500
  },
  moyen: {
    label: 'Moyen',
    hint: 'Correct, mais gache des lancers',
    aimErrorDeg: 7,
    powerErrorRatio: 0.24,
    thinkMs: 650
  },
  difficile: {
    label: 'Difficile',
    hint: 'Ne gache presque rien',
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
   * Sens du vent, si la meteo est activee (absent sinon). Une brise
   * traversiere constante dans l'axe X du terrain, cf. WIND dans rules.ts.
   */
  wind?: 1 | -1;
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

/**
 * Vole en repere-monde (x, y) avec la meme decroissance frictionAir et le
 * meme increment de vent, pas a pas, que le jeu reel (Baton.launch pour la
 * vitesse initiale, MatchScene.update pour l'increment de vent a chaque pas).
 * Renvoie la trajectoire ENTIERE (pas juste le point final) : la verification
 * de securite a besoin de savoir si le baton passe pres du roi en COURS de
 * route, une derive laterale pouvant l'en rapprocher avant meme d'atteindre
 * la distance visee.
 */
export function simulateWindFlight(origin: Point, angle: number, power: number, windDir: 1 | -1): FlightStep[] {
  const k = BATON_BODY.frictionAir;
  const accel = WIND.accelPerStep * windDir;
  let vx = Math.cos(angle) * THROW.maxSpeed * power;
  let vy = Math.sin(angle) * THROW.maxSpeed * power;
  let x = origin.x;
  let y = origin.y;

  const path: FlightStep[] = [{ x, y, speed: Math.hypot(vx, vy) }];
  // 400 pas couvrent largement la plus longue portee possible (v0 max / k
  // vaut environ 2000 px, soit plus que la diagonale du terrain) : le baton
  // repasse toujours sous THROW.restSpeed bien avant.
  for (let i = 0; i < 400; i += 1) {
    vx = vx * (1 - k) + accel;
    vy = vy * (1 - k);
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
  windDir: 1 | -1
): number {
  let angle = naiveAngle;
  for (let pass = 0; pass < 2; pass += 1) {
    const path = simulateWindFlight(origin, angle, power, windDir);
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

/** Positions de lancer envisagees le long de la ligne. */
const POSITION_SAMPLES = 17;
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

  // Le roi est un obstacle dans les deux cas : soit c'est la cible, soit c'est
  // le piege. Seul son rayon change.
  const obstacles: Obstacle[] = board.targets.map((p) => ({ p, radius: KUBB_HIT_RADIUS, kind: 'kubb' as const }));
  if (board.kingStanding) {
    // Vise-t-elle le roi ou l'evite-t-elle ? Seul le second cas gagne une
    // marge de securite pour le vent : un tir legitime sur le roi n'a pas a
    // se mefier de lui-meme.
    const dangerRadius = KING_DANGER_RADIUS + (board.wind ? WIND.kingDangerMargin : 0);
    obstacles.push({
      p: king,
      radius: aimingAtKing ? KING_HIT_RADIUS : dangerRadius,
      kind: 'king' as const
    });
  }
  for (const p of board.obstacles ?? []) {
    obstacles.push({ p, radius: BLOCK_HIT_RADIUS, kind: 'block' as const });
  }

  const forward = board.direction === -1 ? -Math.PI / 2 : Math.PI / 2;
  const maxDelta = AIM.maxAngleDeg * DEG;
  const minX = FIELD.x + THROW_LINE_MARGIN;
  const maxX = FIELD.x + FIELD.width - THROW_LINE_MARGIN;

  const candidates: Candidate[] = [];

  for (let i = 0; i < POSITION_SAMPLES; i += 1) {
    const throwX = minX + ((maxX - minX) * i) / (POSITION_SAMPLES - 1);
    const origin: Point = { x: throwX, y: board.throwerY };

    for (const target of targets) {
      const distance = Math.hypot(target.x - origin.x, target.y - origin.y);
      const power = powerForDistance(distance);
      const naiveAngle = Math.atan2(target.y - origin.y, target.x - origin.x);
      // Vise en amont du vent quand il souffle : l'angle "naif" ne suffirait
      // qu'a atteindre la cible sans lui, jamais avec.
      const angle = board.wind
        ? windCompensatedAngle(origin, naiveAngle, power, distance, board.wind)
        : naiveAngle;
      if (Math.abs(wrapAngle(angle - forward)) > maxDelta) continue;

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
  // -1 : on se place a gauche et on tire encore plus a gauche. +1 : l'inverse.
  const side = rng() < 0.5 ? -1 : 1;
  const throwX = side < 0 ? FIELD.x + THROW_LINE_MARGIN : FIELD.x + FIELD.width - THROW_LINE_MARGIN;

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
