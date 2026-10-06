import { describe, expect, it } from 'vitest';
import {
  PROTOCOL_VERSION,
  appendThrow,
  checkSeq,
  createRecord,
  isCompatible,
  type MatchSetup,
  type MatchSnapshot
} from './protocol';

/**
 * Le protocole est le seul endroit du jeu ou une erreur fait diverger DEUX
 * parties au lieu d'en abimer une. Il est pur, donc testable ici sans
 * navigateur — et c'est exactement pour ca qu'il a ete ecrit pur.
 */

const setup: MatchSetup = {
  version: PROTOCOL_VERSION,
  fieldPreset: 'classique',
  wind: null,
  fieldKubbsEnabled: false,
  batons: { blue: 'base', red: 'base' },
  startingTeam: 'blue'
};

const snapshot: MatchSnapshot = {
  kubbs: { blue: ['baseline'], red: ['out'] },
  kingStanding: true,
  throwsLeft: { blue: 11, red: 12 },
  activeTeam: 'red'
};

describe('checkSeq', () => {
  it('accepte le numero attendu', () => {
    expect(checkSeq(0, 0)).toBe('attendu');
    expect(checkSeq(7, 7)).toBe('attendu');
  });

  it('voit un doublon dans un numero deja passe', () => {
    // Message rejoue par le transport : benin, on l'ignore.
    expect(checkSeq(3, 2)).toBe('doublon');
    expect(checkSeq(3, 0)).toBe('doublon');
  });

  it('voit un coup manquant dans un numero trop grand', () => {
    // Le cas grave : continuer donnerait deux parties differentes.
    expect(checkSeq(3, 4)).toBe('manquant');
    expect(checkSeq(0, 1)).toBe('manquant');
  });
});

describe('appendThrow', () => {
  it('numerote a la place de l appelant, a partir de zero', () => {
    const record = createRecord(setup);
    const a = appendThrow(record, { team: 'blue', input: input(), outcome: snapshot });
    const b = appendThrow(record, { team: 'red', input: input(), outcome: snapshot });
    expect([a.seq, b.seq]).toEqual([0, 1]);
    expect(record.throws).toHaveLength(2);
  });

  it('numerote une SEULE suite pour les deux camps', () => {
    // Les lancers des deux joueurs forment une seule serie : deux compteurs
    // separes laisseraient passer un coup perdu sans que checkSeq le voie.
    const record = createRecord(setup);
    const teams = ['blue', 'red', 'red', 'blue'] as const;
    const seqs = teams.map((team) => appendThrow(record, { team, input: input(), outcome: snapshot }).seq);
    expect(seqs).toEqual([0, 1, 2, 3]);
  });

  it('conserve le resultat quand le lancer termine la partie', () => {
    const record = createRecord(setup);
    const entry = appendThrow(record, {
      team: 'blue',
      input: input(),
      outcome: snapshot,
      result: { winner: 'blue', reason: 'king-down', knockedDown: { blue: 5, red: 0 } }
    });
    expect(entry.result?.winner).toBe('blue');
  });
});

describe('isCompatible', () => {
  it('accepte la version courante', () => {
    expect(isCompatible(setup)).toBe(true);
  });

  it('refuse toute autre version', () => {
    expect(isCompatible({ ...setup, version: PROTOCOL_VERSION + 1 })).toBe(false);
    expect(isCompatible({ ...setup, version: PROTOCOL_VERSION - 1 })).toBe(false);
  });
});

describe('createRecord', () => {
  it('ouvre une partie vide sur les conditions donnees', () => {
    const record = createRecord(setup);
    expect(record.throws).toEqual([]);
    expect(record.setup).toEqual(setup);
  });
});

function input() {
  return {
    throwX: 120,
    angle: -1.5,
    power: 0.8,
    spin: 0,
    batonId: 'base' as const,
    roll: { deviationRad: 0.01, spinSign: 1 as const }
  };
}
