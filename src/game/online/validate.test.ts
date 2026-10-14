import { describe, expect, it } from 'vitest';
import { parseOnlineMessage } from './validate';
import { PROTOCOL_VERSION, type MatchSetup, type RecordedThrow } from './protocol';
import type { OnlineMessage } from './transport';

const setup: MatchSetup = {
  version: PROTOCOL_VERSION,
  fieldPreset: 'classique',
  wind: { direction: 'NE', force: 2 },
  fieldKubbsEnabled: false,
  batons: { blue: 'base', red: 'nordique' },
  startingTeam: 'blue'
};

const entry: RecordedThrow = {
  seq: 0,
  team: 'blue',
  input: { throwX: 120, angle: -1.57, power: 0.8, spin: 0.2, batonId: 'base', roll: { deviationRad: 0.02, spinSign: 1 } },
  outcome: {
    kubbs: { blue: ['baseline', 'baseline', 'baseline', 'baseline', 'baseline'], red: ['out', 'baseline', 'baseline', 'baseline', 'baseline'] },
    kingStanding: true,
    throwsLeft: { blue: 11, red: 12 },
    activeTeam: 'red'
  }
};

const messages: OnlineMessage[] = [
  { kind: 'join', playerId: 'invite-AB12', batonId: 'sniper', card: { level: 12, skins: { kubb: 'marbre', trail: 'glace' } } },
  { kind: 'welcome', playerId: 'hote-AB12', setup, guestTeam: 'red', card: { level: 3 } },
  { kind: 'throw', entry },
  { kind: 'throw', entry: { ...entry, seq: 5, result: { winner: 'blue', reason: 'king-down', knockedDown: { blue: 5, red: 4 } } } },
  { kind: 'resync', playerId: 'hote-AB12', record: { setup, throws: [entry] } },
  { kind: 'rematch', playerId: 'a' },
  { kind: 'rematch-start', playerId: 'a', setup: { ...setup, wind: null } },
  { kind: 'leave', playerId: 'a' },
  { kind: 'ping', playerId: 'a' },
  { kind: 'chat', playerId: 'a', text: 'bien joue' }
];

describe('validate : les messages bien formes passent tels quels', () => {
  it.each(messages)('$kind', (m) => {
    expect(parseOnlineMessage(JSON.parse(JSON.stringify(m)))).toEqual(m);
  });
});

describe('validate : le reste est refuse', () => {
  const bad = (m: unknown) => expect(parseOnlineMessage(m)).toBeNull();

  it('formes absurdes', () => {
    for (const m of [null, undefined, 3, 'throw', [], {}, { kind: 3 }, { kind: 'inconnu' }]) bad(m);
  });

  it("un coup sans `entry`, ou dont les nombres ne sont pas finis", () => {
    bad({ kind: 'throw' });
    bad({ kind: 'throw', entry: { ...entry, input: { ...entry.input, power: NaN } } });
    bad({ kind: 'throw', entry: { ...entry, input: { ...entry.input, angle: Infinity } } });
    bad({ kind: 'throw', entry: { ...entry, input: { ...entry.input, power: 5 } } });
    bad({ kind: 'throw', entry: { ...entry, input: { ...entry.input, spin: -3 } } });
    bad({ kind: 'throw', entry: { ...entry, seq: -1 } });
    bad({ kind: 'throw', entry: { ...entry, seq: 1.5 } });
  });

  it('une carte avec un skin inconnu', () => {
    bad({ kind: 'join', playerId: 'x', batonId: 'sniper', card: { level: 1, skins: { kubb: 'or', trail: 'none' } } });
    bad({ kind: 'join', playerId: 'x', batonId: 'sniper', card: { level: 1, skins: { kubb: 'bois', trail: '__proto__' } } });
    bad({ kind: 'join', playerId: 'x', batonId: 'sniper', card: { level: 1, skins: 'marbre' } });
  });

  it('un projectile ou un terrain inconnu', () => {
    bad({ kind: 'join', playerId: 'x', batonId: 'canon', card: { level: 1 } });
    bad({ kind: 'join', playerId: 'x', batonId: '__proto__', card: { level: 1 } });
    bad({ kind: 'welcome', playerId: 'x', guestTeam: 'red', card: { level: 1 }, setup: { ...setup, fieldPreset: 'lave' } });
    bad({ kind: 'welcome', playerId: 'x', guestTeam: 'red', card: { level: 1 }, setup: { ...setup, fieldPreset: 'constructor' } });
    bad({ kind: 'welcome', playerId: 'x', guestTeam: 'vert', card: { level: 1 }, setup });
    bad({ kind: 'welcome', playerId: 'x', guestTeam: 'red', card: { level: 1 }, setup: { ...setup, batons: { blue: 'base', red: 'canon' } } });
    bad({ kind: 'welcome', playerId: 'x', guestTeam: 'red', card: { level: 1 }, setup: { ...setup, wind: { direction: 'UP', force: 2 } } });
  });

  it('un instantane mal forme', () => {
    bad({ kind: 'throw', entry: { ...entry, outcome: { ...entry.outcome, kubbs: { blue: ['baseline'], red: [] } } } });
    bad({ kind: 'throw', entry: { ...entry, outcome: { ...entry.outcome, throwsLeft: { blue: 99, red: 0 } } } });
    bad({ kind: 'throw', entry: { ...entry, outcome: { ...entry.outcome, kubbs: { ...entry.outcome.kubbs, red: ['x', 'x', 'x', 'x', 'x'] } } } });
  });

  it("une partie renvoyee absurde (trop longue, ou dont un coup est invalide)", () => {
    bad({ kind: 'resync', playerId: 'x', record: { setup, throws: Array.from({ length: 500 }, () => entry) } });
    bad({ kind: 'resync', playerId: 'x', record: { setup, throws: [entry, { kind: 'x' }] } });
  });

  it('identifiants et tchat demesures', () => {
    bad({ kind: 'ping', playerId: '' });
    bad({ kind: 'ping', playerId: 'x'.repeat(500) });
    bad({ kind: 'chat', playerId: 'x', text: 'a'.repeat(5000) });
    bad({ kind: 'chat', playerId: 'x', text: 42 });
  });

  it('aucun champ inconnu ne traverse', () => {
    const m = parseOnlineMessage({ kind: 'ping', playerId: 'x', evil: '<script>', __proto__: { polluted: true } }) as object;
    expect(m).toEqual({ kind: 'ping', playerId: 'x' });
    expect(Object.keys(m)).toEqual(['kind', 'playerId']);
  });
});
