import type { KubbStatus } from '../entities/Kubb';
import type { TeamId } from '../entities/teamData';
import type { BatonId } from '../batons';
import type { FieldPresetId, Wind } from '../rules';
import type { MatchResult } from '../matchResult';

/**
 * Protocole d'une partie : ce qui doit transiter entre deux joueurs en
 * ligne, et ce qu'on garde d'une partie pour pouvoir la rejouer.
 *
 * Module volontairement PUR (aucun import de Phaser ni du store), comme
 * ai.ts / rules.ts / roguelite.ts : c'est le contrat, pas son execution. Il
 * doit pouvoir etre lu par un futur serveur (Node) aussi bien que par le
 * navigateur, sans embarquer le moteur de jeu.
 *
 * ------------------------------------------------------------------
 * Pourquoi un resultat est transmis, et pas seulement le coup
 * ------------------------------------------------------------------
 * La physique du jeu n'est PAS reproductible d'un appareil a l'autre : le
 * pas de simulation Matter suit le delta de frame (cf. matterConfig.ts,
 * aucun pas fixe), donc deux telephones a 60 et 120 Hz ne calculent pas la
 * meme trajectoire. Rejouer seulement les entrees ferait diverger les deux
 * parties.
 *
 * Le lanceur fait donc autorite : il envoie ses entrees ET l'etat du
 * terrain APRES son lancer (`MatchSnapshot`). L'adversaire rejoue les
 * entrees pour l'animation, puis se cale sur l'instantane. Une divergence
 * ne coute alors qu'une fraction de seconde d'animation, jamais l'etat de
 * la partie.
 *
 * Ce choix est volontairement naif face a la triche : un joueur pourrait
 * mentir sur son resultat. C'est sans consequence entre amis, et c'est
 * precisement pourquoi la partie entiere est enregistree (`MatchRecord`) —
 * un serveur pourra plus tard la rejouer pour valider un classement, sans
 * qu'on ait a changer le protocole.
 */

/** Incremente a chaque changement incompatible : deux versions differentes ne jouent pas ensemble. */
export const PROTOCOL_VERSION = 1;

/**
 * Part d'aleatoire d'un lancer, tiree par le LANCEUR et transmise telle
 * quelle : sans elle, l'adversaire verrait un baton partir droit sur une
 * cible que l'instantane declare pourtant manquee.
 */
export interface ThrowRoll {
  /** Deviation reellement appliquee a l'angle vise, en radians. */
  deviationRad: number;
  /** Sens de rotation du projectile en vol (purement visuel). */
  spinSign: -1 | 1;
}

/** Tout ce qui definit un lancer, cote entrees. */
export interface ThrowInput {
  /** Position de lancer choisie le long de la ligne (cf. THROW_POSITIONS). */
  throwX: number;
  /** Angle vise, en radians, avant deviation. */
  angle: number;
  /** Jauge de puissance, entre AIM.minPower et 1. */
  power: number;
  /** Projectile du lanceur : il change la vitesse, la deviation et la forme du corps. */
  batonId: BatonId;
  roll: ThrowRoll;
}

/**
 * Etat du terrain a un instant donne — la verite que le lanceur transmet.
 * Volontairement minimal : les positions ne sont pas transmises car elles
 * se deduisent (un kubb de champ va toujours dans le meme emplacement, cf.
 * MatchScene::fieldKubbSlot) et un kubb 'out' n'est plus que du decor.
 */
export interface MatchSnapshot {
  /** Statut des 5 kubbs de chaque equipe, dans l'ordre de leur index. */
  kubbs: Record<TeamId, KubbStatus[]>;
  kingStanding: boolean;
  throwsLeft: Record<TeamId, number>;
  /** A qui de jouer APRES ce lancer. */
  activeTeam: TeamId;
  stage: 'opening' | 'match';
}

/** Un lancer joue, tel qu'il part sur le reseau et tel qu'on l'archive. */
export interface RecordedThrow {
  /** Numero d'ordre, a partir de 0 : sert a detecter un message perdu ou rejoue. */
  seq: number;
  team: TeamId;
  input: ThrowInput;
  /** Etat du terrain apres ce lancer, selon le lanceur (il fait autorite). */
  outcome: MatchSnapshot;
  /**
   * Renseigne uniquement si CE lancer a termine la partie. L'instantane ne
   * suffit pas a le deduire : un roi couche peut signifier une victoire ou
   * une defaite du lanceur selon qu'il avait le droit de le viser, et cette
   * information n'existe que chez lui. Le receveur applique donc le
   * resultat tel quel, plutot que de tenter de le recalculer.
   */
  result?: MatchResult;
}

/**
 * Ce sur quoi les deux joueurs doivent s'accorder AVANT le premier lancer.
 * Tire par l'hote et envoye a l'invite : sans cela, chacun jouerait sur un
 * terrain different (le vent, notamment, est tire au hasard a chaque
 * creation de partie).
 */
export interface MatchSetup {
  version: number;
  fieldPreset: FieldPresetId;
  /** null si la meteo est desactivee. */
  wind: Wind | null;
  fieldKubbsEnabled: boolean;
  /** Projectile de chaque camp — il a un vrai effet de jeu, pas cosmetique. */
  batons: Record<TeamId, BatonId>;
  /**
   * Qui commence, tire au sort par l'hote.
   *
   * Simplification ASSUMEE de la premiere version en ligne : le tir
   * d'ouverture (chaque camp approche le roi, le plus pres commence) est
   * saute. Son arbitrage a besoin des DEUX mesures avant de trancher, ce
   * qui en fait un etat reparti — avec rejeu quand les deux touchent le
   * roi, et donc toute une classe de desynchronisations pour un mecanisme
   * qui ne fait que designer le premier joueur. Le tirage au sort par
   * l'hote donne le meme resultat sans le risque. A reprendre si l'on veut
   * l'ouverture fidele en ligne.
   */
  startingTeam: TeamId;
}

/**
 * Une partie complete et rejouable : les conditions de depart, puis la
 * suite des lancers. Suffit a reconstituer le deroulement sans rien
 * connaitre de l'appareil qui l'a produite.
 */
export interface MatchRecord {
  setup: MatchSetup;
  throws: RecordedThrow[];
}

export function createRecord(setup: MatchSetup): MatchRecord {
  return { setup, throws: [] };
}

/**
 * Ajoute un lancer a l'enregistrement, en numerotant a la place de
 * l'appelant — le numero d'ordre ne doit jamais dependre d'un compteur
 * tenu ailleurs.
 */
export function appendThrow(
  record: MatchRecord,
  entry: Omit<RecordedThrow, 'seq'>
): RecordedThrow {
  const recorded: RecordedThrow = { seq: record.throws.length, ...entry };
  record.throws.push(recorded);
  return recorded;
}

/**
 * Le message recu est-il celui qu'on attend ? Un numero deja vu est un
 * doublon (a ignorer), un numero trop grand signale un message perdu (la
 * partie ne peut pas continuer en silence).
 */
export type SeqCheck = 'attendu' | 'doublon' | 'manquant';

export function checkSeq(expectedSeq: number, received: number): SeqCheck {
  if (received === expectedSeq) return 'attendu';
  return received < expectedSeq ? 'doublon' : 'manquant';
}

/** Deux parties ne peuvent commencer que si les protocoles concordent. */
export function isCompatible(setup: MatchSetup): boolean {
  return setup.version === PROTOCOL_VERSION;
}
