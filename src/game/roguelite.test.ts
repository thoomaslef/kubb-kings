import { describe, expect, it } from 'vitest';
import { LANCER_BONUS_THROWS, PERK_IDS, POIGNE_FERME_KING_THRESHOLD_MULTIPLIER, defiWindForce } from './roguelite';

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
    expect(PERK_IDS).toHaveLength(16);
  });
});
