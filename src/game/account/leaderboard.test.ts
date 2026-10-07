import { describe, expect, it } from 'vitest';
import { cleanPseudo, sanitizeEntries, sanitizeStanding } from './leaderboard';

describe('sanitizeEntries : le classement du serveur n est jamais cru sur parole', () => {
  it('rend un tableau vide pour autre chose qu un tableau', () => {
    expect(sanitizeEntries(null)).toEqual([]);
    expect(sanitizeEntries('x')).toEqual([]);
    expect(sanitizeEntries({})).toEqual([]);
  });

  it('convertit une ligne valide', () => {
    const [e] = sanitizeEntries([
      { place: 1, pseudo: 'RapideViking42', rank_index: 12, rank_peak: 13, wins: 20, losses: 7, is_me: true }
    ]);
    expect(e).toEqual({ place: 1, pseudo: 'RapideViking42', rankIndex: 12, peak: 13, wins: 20, losses: 7, isMe: true });
  });

  it('rattrape les valeurs absurdes : rang hors echelle, negatifs, texte', () => {
    const [e] = sanitizeEntries([{ place: -4, pseudo: 'A', rank_index: 999, rank_peak: 2, wins: -1, losses: 'x', is_me: 'oui' }]);
    expect(e.rankIndex).toBe(17);
    expect(e.peak).toBe(17); // jamais sous le rang actuel
    expect(e.place).toBe(1);
    expect(e.wins).toBe(0);
    expect(e.losses).toBe(0);
    expect(e.isMe).toBe(false); // seulement un vrai booleen
  });

  it('ecarte les lignes sans pseudo exploitable', () => {
    const out = sanitizeEntries([{ place: 1, pseudo: '   ' }, { place: 2, pseudo: 12 }, null, { place: 3, pseudo: 'Ok' }]);
    expect(out.map((e) => e.pseudo)).toEqual(['Ok']);
  });

  it('remet les lignes dans l ordre des places', () => {
    const out = sanitizeEntries([
      { place: 3, pseudo: 'C' },
      { place: 1, pseudo: 'A' },
      { place: 2, pseudo: 'B' }
    ]);
    expect(out.map((e) => e.pseudo)).toEqual(['A', 'B', 'C']);
  });
});

describe('cleanPseudo : un nom qui s affiche ne casse rien', () => {
  it('retire balises et caracteres de controle, borne la longueur', () => {
    expect(cleanPseudo('<b>Roi</b>\u0007')).toBe('bRoi/b');
    expect(cleanPseudo('x'.repeat(100))!.length).toBe(32);
    expect(cleanPseudo('')).toBeNull();
    expect(cleanPseudo(undefined)).toBeNull();
  });
});

describe('sanitizeStanding', () => {
  it('lit la premiere ligne, un tableau ou un objet', () => {
    expect(sanitizeStanding([{ pseudo: 'A1', visible: true, place: 4, total: 30 }])).toEqual({
      pseudo: 'A1',
      visible: true,
      place: 4,
      total: 30
    });
    expect(sanitizeStanding({ pseudo: 'B', visible: false, place: null, total: 2 })).toEqual({
      pseudo: 'B',
      visible: false,
      place: null,
      total: 2
    });
  });

  it('refuse le vide', () => {
    expect(sanitizeStanding([])).toBeNull();
    expect(sanitizeStanding(null)).toBeNull();
  });
});
