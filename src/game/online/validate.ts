import type { OnlineMessage } from './transport';
import type { MatchRecord, MatchSetup, MatchSnapshot, PlayerCard, RecordedThrow, ThrowInput } from './protocol';
import type { MatchResult, WinReason } from '../matchResult';
import type { TeamId } from '../entities/teamData';
import type { KubbStatus } from '../entities/Kubb';
import { BATON_IDS, type BatonId } from '../batons';
import { KUBB_SKINS, type KubbSkin } from '../theme';
import { THROW_EFFECT_IDS, type ThrowEffectId } from '../throwEffects';
import { FIELD_PRESETS, KUBBS_PER_TEAM, MAX_THROWS_PER_TEAM, WIND_DIRECTIONS, type FieldPresetId } from '../rules';

/**
 * Validation des messages venus du reseau.
 *
 * Le canal est PUBLIC (le code de salon est son seul secret) : rien ne garantit
 * qu'un message vienne de notre interface. Sans ce filtre, un message mal forme
 * — un projectile inconnu, un terrain qui n'existe pas, un coup sans `entry` —
 * faisait lever une exception ou propageait un NaN dans la physique chez
 * l'adversaire. Module PUR, comme protocol.ts. Un message invalide est
 * simplement ignore (jamais de reponse : on n'aide pas un emetteur hostile).
 *
 * Ce n'est PAS un arbitrage (un joueur peut toujours mentir sur un resultat
 * bien forme, cf. protocol.ts) : seulement la garantie que ce que l'on lit a la
 * forme attendue et des valeurs dans leurs bornes.
 */

const TEAMS: readonly string[] = ['blue', 'red'];
const KUBB_STATUSES: readonly string[] = ['baseline', 'field', 'out'];
const WIN_REASONS: readonly string[] = ['king-down', 'king-early', 'throws-exhausted'];
/** Plus long qu'une partie reelle (2 x MAX_THROWS_PER_TEAM) : une borne anti-abus, pas une regle. */
const MAX_RECORDED_THROWS = 4 * MAX_THROWS_PER_TEAM;
const MAX_ID_LENGTH = 80;
const MAX_CHAT_RAW_LENGTH = 2000;

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const inRange = (v: unknown, min: number, max: number): v is number => isNum(v) && v >= min && v <= max;
const isInt = (v: unknown, min: number, max: number): v is number => inRange(v, min, max) && Number.isInteger(v);
const isTeam = (v: unknown): v is TeamId => typeof v === 'string' && TEAMS.includes(v);
const isBaton = (v: unknown): v is BatonId => typeof v === 'string' && (BATON_IDS as readonly string[]).includes(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= MAX_ID_LENGTH;

function card(v: unknown): PlayerCard | null {
  // Une carte absente est acceptee (anciens clients) ; une carte mal formee est refusee.
  if (!isObj(v) || !isInt(v.level, 0, 10_000)) return null;
  if (v.skins === undefined) return { level: v.level };
  // Les skins ne sont que cosmetiques, mais un identifiant inconnu ferait chercher une texture qui
  // n'existe pas : on refuse la carte plutot que de laisser le jeu s'y tromper.
  if (!isObj(v.skins)) return null;
  const { kubb, trail } = v.skins;
  if (typeof kubb !== 'string' || !(KUBB_SKINS as readonly string[]).includes(kubb)) return null;
  if (typeof trail !== 'string' || !(THROW_EFFECT_IDS as readonly string[]).includes(trail)) return null;
  return { level: v.level, skins: { kubb: kubb as KubbSkin, trail: trail as ThrowEffectId } };
}

export function parseSetup(v: unknown): MatchSetup | null {
  if (!isObj(v) || !isInt(v.version, 0, 1000)) return null;
  if (typeof v.fieldPreset !== 'string' || !Object.prototype.hasOwnProperty.call(FIELD_PRESETS, v.fieldPreset)) return null;
  let wind: MatchSetup['wind'] = null;
  if (v.wind !== null) {
    if (!isObj(v.wind) || !WIND_DIRECTIONS.includes(v.wind.direction as never) || (v.wind.force !== 1 && v.wind.force !== 2)) {
      return null;
    }
    wind = { direction: v.wind.direction as never, force: v.wind.force };
  }
  if (typeof v.fieldKubbsEnabled !== 'boolean') return null;
  if (!isObj(v.batons) || !isBaton(v.batons.blue) || !isBaton(v.batons.red)) return null;
  if (!isTeam(v.startingTeam)) return null;
  return {
    version: v.version,
    fieldPreset: v.fieldPreset as FieldPresetId,
    wind,
    fieldKubbsEnabled: v.fieldKubbsEnabled,
    batons: { blue: v.batons.blue, red: v.batons.red },
    startingTeam: v.startingTeam
  };
}

function statuses(v: unknown): KubbStatus[] | null {
  if (!Array.isArray(v) || v.length !== KUBBS_PER_TEAM) return null;
  if (!v.every((s) => typeof s === 'string' && KUBB_STATUSES.includes(s))) return null;
  return v as KubbStatus[];
}

function snapshot(v: unknown): MatchSnapshot | null {
  if (!isObj(v) || !isObj(v.kubbs) || !isObj(v.throwsLeft)) return null;
  const blue = statuses(v.kubbs.blue);
  const red = statuses(v.kubbs.red);
  if (!blue || !red) return null;
  if (typeof v.kingStanding !== 'boolean' || !isTeam(v.activeTeam)) return null;
  if (!isInt(v.throwsLeft.blue, 0, MAX_THROWS_PER_TEAM) || !isInt(v.throwsLeft.red, 0, MAX_THROWS_PER_TEAM)) return null;
  return {
    kubbs: { blue, red },
    kingStanding: v.kingStanding,
    throwsLeft: { blue: v.throwsLeft.blue, red: v.throwsLeft.red },
    activeTeam: v.activeTeam
  };
}

function result(v: unknown): MatchResult | null {
  if (!isObj(v) || !isObj(v.knockedDown)) return null;
  if (!(v.winner === 'draw' || isTeam(v.winner))) return null;
  if (typeof v.reason !== 'string' || !WIN_REASONS.includes(v.reason)) return null;
  if (!isInt(v.knockedDown.blue, 0, KUBBS_PER_TEAM) || !isInt(v.knockedDown.red, 0, KUBBS_PER_TEAM)) return null;
  return {
    winner: v.winner as MatchResult['winner'],
    reason: v.reason as WinReason,
    knockedDown: { blue: v.knockedDown.blue, red: v.knockedDown.red }
  };
}

function input(v: unknown): ThrowInput | null {
  if (!isObj(v) || !isObj(v.roll)) return null;
  if (!inRange(v.throwX, -10_000, 10_000) || !inRange(v.angle, -10, 10)) return null;
  if (!inRange(v.power, 0, 1) || !inRange(v.spin, -1, 1)) return null;
  if (!isBaton(v.batonId)) return null;
  if (!inRange(v.roll.deviationRad, -3.2, 3.2) || (v.roll.spinSign !== 1 && v.roll.spinSign !== -1)) return null;
  return {
    throwX: v.throwX,
    angle: v.angle,
    power: v.power,
    spin: v.spin,
    batonId: v.batonId,
    roll: { deviationRad: v.roll.deviationRad, spinSign: v.roll.spinSign }
  };
}

export function parseThrow(v: unknown): RecordedThrow | null {
  if (!isObj(v) || !isInt(v.seq, 0, MAX_RECORDED_THROWS) || !isTeam(v.team)) return null;
  const inp = input(v.input);
  const outcome = snapshot(v.outcome);
  if (!inp || !outcome) return null;
  const entry: RecordedThrow = { seq: v.seq, team: v.team, input: inp, outcome };
  if (v.result !== undefined) {
    const r = result(v.result);
    if (!r) return null;
    entry.result = r;
  }
  return entry;
}

function record(v: unknown): MatchRecord | null {
  if (!isObj(v) || !Array.isArray(v.throws) || v.throws.length > MAX_RECORDED_THROWS) return null;
  const setup = parseSetup(v.setup);
  if (!setup) return null;
  const throws: RecordedThrow[] = [];
  for (const t of v.throws) {
    const parsed = parseThrow(t);
    if (!parsed) return null;
    throws.push(parsed);
  }
  return { setup, throws };
}

/** Le message, reconstruit champ par champ (aucun champ inconnu ne passe), ou `null` s'il est invalide. */
export function parseOnlineMessage(raw: unknown): OnlineMessage | null {
  if (!isObj(raw) || typeof raw.kind !== 'string') return null;
  switch (raw.kind) {
    case 'join': {
      if (!isId(raw.playerId) || !isBaton(raw.batonId)) return null;
      const c = raw.card === undefined ? null : card(raw.card);
      if (raw.card !== undefined && !c) return null;
      return { kind: 'join', playerId: raw.playerId, batonId: raw.batonId, card: c as PlayerCard };
    }
    case 'welcome': {
      const setup = parseSetup(raw.setup);
      if (!isId(raw.playerId) || !setup || !isTeam(raw.guestTeam)) return null;
      const c = raw.card === undefined ? null : card(raw.card);
      if (raw.card !== undefined && !c) return null;
      return { kind: 'welcome', playerId: raw.playerId, setup, guestTeam: raw.guestTeam, card: c as PlayerCard };
    }
    case 'throw': {
      const entry = parseThrow(raw.entry);
      return entry ? { kind: 'throw', entry } : null;
    }
    case 'resync': {
      const rec = record(raw.record);
      return isId(raw.playerId) && rec ? { kind: 'resync', playerId: raw.playerId, record: rec } : null;
    }
    case 'rematch-start': {
      const setup = parseSetup(raw.setup);
      return isId(raw.playerId) && setup ? { kind: 'rematch-start', playerId: raw.playerId, setup } : null;
    }
    case 'leave':
    case 'ping':
    case 'rematch':
      return isId(raw.playerId) ? ({ kind: raw.kind, playerId: raw.playerId } as OnlineMessage) : null;
    case 'chat':
      // Le texte est assaini ensuite (chat.ts) ; ici, seulement une borne qui evite de le traiter s'il est enorme.
      return isId(raw.playerId) && typeof raw.text === 'string' && raw.text.length <= MAX_CHAT_RAW_LENGTH
        ? { kind: 'chat', playerId: raw.playerId, text: raw.text }
        : null;
    default:
      return null;
  }
}
