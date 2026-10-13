import { describe, expect, it } from 'vitest';
import { defiWindForce } from './roguelite';

describe('defiWindForce', () => {
  it('aucun vent avant la manche 10, leger de 10 a 19, plus fort a partir de 20', () => {
    for (let n = 1; n <= 9; n += 1) expect(defiWindForce(n), `manche ${n}`).toBeNull();
    for (let n = 10; n <= 19; n += 1) expect(defiWindForce(n), `manche ${n}`).toBe(1);
    for (let n = 20; n <= 30; n += 1) expect(defiWindForce(n), `manche ${n}`).toBe(2);
  });
});
