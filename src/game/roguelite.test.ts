import { describe, expect, it } from 'vitest';
import {
  LANCER_BONUS_THROWS,
  PERK_IDS,
  PILLAGE_COINS_PER_KUBB,
  POIGNE_FERME_KING_THRESHOLD_MULTIPLIER,
  TRAIT_GUIDE_LENGTH_MULTIPLIER,
  defiWindForce
} from './roguelite';
import { computeCoinsAward } from './currency';
import { aimArrowLength } from './rules';

describe('defiWindForce', () => {
  it('aucun vent avant la manche 10, leger de 10 a 19, plus fort a partir de 20', () => {
    for (let n = 1; n <= 9; n += 1) expect(defiWindForce(n), `manche ${n}`).toBeNull();
    for (let n = 10; n <= 19; n += 1) expect(defiWindForce(n), `manche ${n}`).toBe(1);
    for (let n = 20; n <= 30; n += 1) expect(defiWindForce(n), `manche ${n}`).toBe(2);
  });
});

describe('reglages des bonus du Defi', () => {
  it('Bras infatigable donne 1 lancer', () => {
    expect(LANCER_BONUS_THROWS).toBe(1);
  });

  it('Poigne ferme rend le roi plus difficile a renverser (seuil releve)', () => {
    expect(POIGNE_FERME_KING_THRESHOLD_MULTIPLIER).toBeGreaterThan(1);
  });

  it("Elan n'existe plus", () => {
    expect((PERK_IDS as readonly string[]).includes('elan')).toBe(false);
    expect(PERK_IDS).toHaveLength(18);
  });
});

describe('Pillage', () => {
  it('ajoute des pieces par kubb abattu, avant Bourse pleine', () => {
    // 5 kubbs, victoire : (20 + 5 x 10 + 50) = 120 ; avec Pillage : 20 + 5 x 18 + 50 = 160.
    expect(computeCoinsAward(5, true)).toBe(120);
    expect(computeCoinsAward(5, true, 0, 1, PILLAGE_COINS_PER_KUBB)).toBe(120 + 5 * PILLAGE_COINS_PER_KUBB);
    // Aucun kubb abattu : rien de plus. Les pieces de succes restent hors du bareme multiplie.
    expect(computeCoinsAward(0, false, 0, 1, PILLAGE_COINS_PER_KUBB)).toBe(20);
    expect(computeCoinsAward(5, true, 30, 1.5, PILLAGE_COINS_PER_KUBB)).toBe(Math.round(160 * 1.5) + 30);
  });
});

describe('Trait guide', () => {
  it('allonge la fleche de visee sans changer sa forme de base', () => {
    expect(TRAIT_GUIDE_LENGTH_MULTIPLIER).toBeGreaterThan(1);
    for (const p of [0, 0.5, 1]) {
      expect(aimArrowLength(p)).toBe(45 + p * 215);
      expect(aimArrowLength(p, TRAIT_GUIDE_LENGTH_MULTIPLIER)).toBeCloseTo(aimArrowLength(p) * TRAIT_GUIDE_LENGTH_MULTIPLIER, 6);
    }
  });
});
