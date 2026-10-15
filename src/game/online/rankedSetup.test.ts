import { describe, expect, it } from 'vitest';
import { rankedConditions } from './rankedSetup';
import { FIELD_PRESETS } from '../rules';

describe('conditions d une partie classee', () => {
  it('le terrain et le vent sont tires au hasard, sur tous les terrains', () => {
    const vus = new Set<string>();
    let vent = 0;
    const n = 2000;
    for (let i = 0; i < n; i += 1) {
      const c = rankedConditions();
      vus.add(c.preset);
      if (c.wind) vent += 1;
    }
    expect(vus.size).toBe(Object.keys(FIELD_PRESETS).length);
    expect(vent / n).toBeGreaterThan(0.4);
    expect(vent / n).toBeLessThan(0.6);
  });

  it('respecte le generateur injecte', () => {
    expect(rankedConditions(() => 0)).toEqual({ preset: Object.keys(FIELD_PRESETS)[0], wind: true });
    expect(rankedConditions(() => 0.99).wind).toBe(false);
  });
});
