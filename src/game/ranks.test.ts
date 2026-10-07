import { describe, expect, it } from 'vitest';
import {
  DIVISIONS_PER_TIER,
  RANK_COUNT,
  RANK_TIERS,
  applyRankedResult,
  changesTier,
  clampRank,
  initialRankState,
  rankIndex,
  rankPosition,
  stepAfter
} from './ranks';

describe('echelle des rangs', () => {
  it('six paliers de trois divisions, dix-huit marches', () => {
    expect(RANK_TIERS).toEqual(['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master']);
    expect(DIVISIONS_PER_TIER).toBe(3);
    expect(RANK_COUNT).toBe(18);
  });

  it('la marche 0 est Bronze 1 et la derniere est Master 3', () => {
    expect(rankPosition(0)).toEqual({ tier: 'bronze', division: 1 });
    expect(rankPosition(RANK_COUNT - 1)).toEqual({ tier: 'master', division: 3 });
  });

  it('chaque marche a une position unique et rankIndex en est l inverse', () => {
    const seen = new Set<string>();
    for (let i = 0; i < RANK_COUNT; i += 1) {
      const { tier, division } = rankPosition(i);
      expect(division).toBeGreaterThanOrEqual(1);
      expect(division).toBeLessThanOrEqual(3);
      seen.add(`${tier}${division}`);
      expect(rankIndex(tier, division)).toBe(i);
    }
    expect(seen.size).toBe(RANK_COUNT);
  });
});

describe('victoire et defaite', () => {
  it('l exemple demande : Or 2, une victoire, Or 3 — la division 3 est la plus haute', () => {
    const or2 = rankIndex('gold', 2);
    expect(rankPosition(stepAfter(or2, 'win'))).toEqual({ tier: 'gold', division: 3 });
  });

  it('une victoire en haut d un palier passe au palier suivant, division 1', () => {
    expect(rankPosition(stepAfter(rankIndex('gold', 3), 'win'))).toEqual({ tier: 'platinum', division: 1 });
  });

  it('une defaite redescend : Or 1 -> Argent 3, Or 3 -> Or 2', () => {
    expect(rankPosition(stepAfter(rankIndex('gold', 1), 'loss'))).toEqual({ tier: 'silver', division: 3 });
    expect(rankPosition(stepAfter(rankIndex('gold', 3), 'loss'))).toEqual({ tier: 'gold', division: 2 });
  });

  it('un nul ne change rien', () => {
    for (let i = 0; i < RANK_COUNT; i += 1) expect(stepAfter(i, 'draw')).toBe(i);
  });

  it('on ne descend pas sous Bronze 1 ni ne monte au-dela de Master 3', () => {
    expect(stepAfter(0, 'loss')).toBe(0);
    expect(stepAfter(RANK_COUNT - 1, 'win')).toBe(RANK_COUNT - 1);
  });

  it('une marche par resultat, partout : jamais de saut', () => {
    for (let i = 0; i < RANK_COUNT; i += 1) {
      expect(Math.abs(stepAfter(i, 'win') - i)).toBeLessThanOrEqual(1);
      expect(Math.abs(stepAfter(i, 'loss') - i)).toBeLessThanOrEqual(1);
    }
  });

  it('gravir toute l echelle demande dix-sept victoires de suite depuis Bronze 1', () => {
    let state = initialRankState();
    for (let i = 0; i < RANK_COUNT - 1; i += 1) state = applyRankedResult(state, 'win');
    expect(rankPosition(state.index)).toEqual({ tier: 'master', division: 3 });
    expect(state.wins).toBe(17);
  });
});

describe('bilan et meilleur rang', () => {
  it('compte victoires et defaites, pas les nuls', () => {
    let s = initialRankState();
    s = applyRankedResult(s, 'win');
    s = applyRankedResult(s, 'draw');
    s = applyRankedResult(s, 'loss');
    s = applyRankedResult(s, 'loss');
    expect(s).toMatchObject({ wins: 1, losses: 2 });
  });

  it('le meilleur rang survit a une descente', () => {
    let s = initialRankState();
    for (let i = 0; i < 5; i += 1) s = applyRankedResult(s, 'win');
    const sommet = s.index;
    s = applyRankedResult(s, 'loss');
    s = applyRankedResult(s, 'loss');
    expect(s.index).toBe(sommet - 2);
    expect(s.peak).toBe(sommet);
  });

  it('un defaite au plancher compte quand meme, sans faire descendre', () => {
    const s = applyRankedResult(initialRankState(), 'loss');
    expect(s).toMatchObject({ index: 0, losses: 1, peak: 0 });
  });

  it('reconnait un changement de palier', () => {
    expect(changesTier(rankIndex('gold', 3), rankIndex('platinum', 1))).toBe(true);
    expect(changesTier(rankIndex('gold', 2), rankIndex('gold', 3))).toBe(false);
  });

  it('clampRank rattrape les valeurs absurdes', () => {
    expect(clampRank(-5)).toBe(0);
    expect(clampRank(999)).toBe(RANK_COUNT - 1);
    expect(clampRank(Number.NaN)).toBe(0);
    expect(clampRank(3.9)).toBe(3);
  });
});
