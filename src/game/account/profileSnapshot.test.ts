import { describe, expect, it } from 'vitest';
import { emptySnapshot, isPristine, mergeBest, sanitizeSnapshot, snapshotsEqual, type ProfileSnapshot } from './profileSnapshot';

const profile = (patch: Partial<ProfileSnapshot> = {}): ProfileSnapshot => ({ ...emptySnapshot(), ...patch });

describe('sanitizeSnapshot : le JSON distant n est jamais cru sur parole', () => {
  it('refuse ce qui n a pas la forme d un profil', () => {
    expect(sanitizeSnapshot(null)).toBeNull();
    expect(sanitizeSnapshot('x')).toBeNull();
    expect(sanitizeSnapshot(42)).toBeNull();
  });

  it('un objet vide donne un profil vierge', () => {
    expect(isPristine(sanitizeSnapshot({})!)).toBe(true);
  });

  it('rattrape les valeurs absurdes : negatifs, NaN, textes, rang hors echelle', () => {
    const s = sanitizeSnapshot({
      progression: { totalXp: -5, winStreak: 'abc', gamesPlayed: 3.9, totalWins: Number.NaN },
      coins: -1,
      onlineWinStreak: 'x',
      rank: { index: 999, wins: -2, losses: 4, peak: 1 },
      bestStage: 7.8
    })!;
    expect(s.progression).toEqual({ totalXp: 0, winStreak: 0, gamesPlayed: 3, totalWins: 0 });
    expect(s.coins).toBe(0);
    expect(s.onlineWinStreak).toBe(0);
    expect(s.rank).toEqual({ index: 17, wins: 0, losses: 4, peak: 17 });
    expect(s.bestStage).toBe(7);
  });

  it('nettoie les listes : doublons, non-textes, textes demesures', () => {
    const s = sanitizeSnapshot({
      ownedItems: ['a', 'a', 3, null, 'b', 'x'.repeat(200)],
      unlockedAchievements: 'pas une liste'
    })!;
    expect(s.ownedItems).toEqual(['a', 'b']);
    expect(s.unlockedAchievements).toEqual([]);
  });

  it('borne la taille des listes : un compte ne gonfle pas la base', () => {
    const s = sanitizeSnapshot({ ownedItems: Array.from({ length: 5000 }, (_, i) => `id${i}`) })!;
    expect(s.ownedItems.length).toBeLessThanOrEqual(500);
  });

  it('un profil valide survit tel quel a un aller-retour', () => {
    const p = profile({
      progression: { totalXp: 1200, winStreak: 2, gamesPlayed: 30, totalWins: 18 },
      coins: 340,
      ownedItems: ['skin-or'],
      unlockedAchievements: ['froleur'],
      terrainWins: ['classique'],
      onlineWinStreak: 4,
      rank: { index: 7, wins: 9, losses: 5, peak: 8 },
      bestStage: 12
    });
    expect(sanitizeSnapshot(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
});

describe('isPristine et snapshotsEqual', () => {
  it('vierge tant que rien n a ete joue', () => {
    expect(isPristine(emptySnapshot())).toBe(true);
    expect(isPristine(profile({ coins: 1 }))).toBe(false);
    expect(isPristine(profile({ ownedItems: ['x'] }))).toBe(false);
    expect(isPristine(profile({ rank: { index: 0, wins: 0, losses: 1, peak: 0 } }))).toBe(false);
  });

  it('l ordre des listes ne compte pas pour l egalite', () => {
    expect(snapshotsEqual(profile({ ownedItems: ['a', 'b'] }), profile({ ownedItems: ['b', 'a'] }))).toBe(true);
    expect(snapshotsEqual(profile({ coins: 1 }), profile({ coins: 2 }))).toBe(false);
  });
});

describe('mergeBest : le meilleur des deux', () => {
  const a = profile({
    progression: { totalXp: 500, winStreak: 1, gamesPlayed: 10, totalWins: 6 },
    coins: 100,
    ownedItems: ['a', 'b'],
    unlockedAchievements: ['x'],
    terrainWins: ['classique'],
    onlineWinStreak: 2,
    rank: { index: 4, wins: 3, losses: 1, peak: 5 },
    bestStage: 3
  });
  const b = profile({
    progression: { totalXp: 900, winStreak: 0, gamesPlayed: 25, totalWins: 12 },
    coins: 40,
    ownedItems: ['b', 'c'],
    unlockedAchievements: ['y'],
    terrainWins: ['glace'],
    onlineWinStreak: 5,
    rank: { index: 8, wins: 8, losses: 6, peak: 9 },
    bestStage: 1
  });

  it('l XP vient d un seul profil, en bloc, pour rester coherente', () => {
    expect(mergeBest(a, b).progression).toEqual(b.progression);
  });

  it('union des succes, articles et terrains ; maximum des series et du Defi', () => {
    const m = mergeBest(a, b);
    expect([...m.ownedItems].sort()).toEqual(['a', 'b', 'c']);
    expect([...m.unlockedAchievements].sort()).toEqual(['x', 'y']);
    expect([...m.terrainWins].sort()).toEqual(['classique', 'glace']);
    expect(m.onlineWinStreak).toBe(5);
    expect(m.bestStage).toBe(3);
  });

  it('rang : celui qui a le plus de parties classees ; le meilleur rang atteint est conserve', () => {
    const m = mergeBest(a, b);
    expect(m.rank.index).toBe(8);
    expect(m.rank.peak).toBe(9);
  });

  it('pieces : le maximum (compromis assume)', () => {
    expect(mergeBest(a, b).coins).toBe(100);
  });

  it('symetrique, et fusionner avec un profil vierge ne change rien', () => {
    expect(snapshotsEqual(mergeBest(a, b), mergeBest(b, a))).toBe(true);
    expect(snapshotsEqual(mergeBest(a, emptySnapshot()), a)).toBe(true);
  });

  it('ne perd rien : jamais moins que chacun des deux', () => {
    const m = mergeBest(a, b);
    expect(m.progression.totalXp).toBeGreaterThanOrEqual(Math.max(a.progression.totalXp, b.progression.totalXp));
    expect(m.coins).toBeGreaterThanOrEqual(Math.max(a.coins, b.coins));
    for (const id of [...a.ownedItems, ...b.ownedItems]) expect(m.ownedItems).toContain(id);
  });
});
