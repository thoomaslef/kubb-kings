import { describe, expect, it, vi } from 'vitest';
import { analyticsEnabled, buildUsageEvent } from './analytics';

describe('mesure d usage anonyme', () => {
  it("un evenement ne porte que les champs prevus : rien d'identifiant, rien de libre", () => {
    const e = buildUsageEvent('match_end', { mode: 'ranked', result: 'win', seconds: 95.4 });
    expect(Object.keys(e).sort()).toEqual(['mode', 'name', 'result', 'seconds', 'version']);
    expect(e.seconds).toBe(95);
    expect(buildUsageEvent('session_start')).toEqual({ name: 'session_start', version: expect.any(String) });
  });

  it('les durees sont bornees', () => {
    expect(buildUsageEvent('match_end', { seconds: -5 }).seconds).toBe(0);
    expect(buildUsageEvent('match_end', { seconds: 10_000_000 }).seconds).toBe(86_400);
    expect(buildUsageEvent('match_end', { seconds: Number.NaN }).seconds).toBeUndefined();
  });

  it('inerte sans projet configure', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    expect(analyticsEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });
});
