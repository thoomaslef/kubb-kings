import { FIELD_PRESETS, type FieldPresetId } from '../rules';

/**
 * Terrain et vent d'une partie classee : tires au hasard. Les verifications en navigateur (build de test
 * seulement) peuvent les FORCER via `window.__kubbForcedRankedSetup`, pour jouer un scenario precis.
 */
export function rankedConditions(random: () => number = Math.random): { preset: FieldPresetId; wind: boolean } {
  const forced =
    typeof window !== 'undefined' && (import.meta.env.DEV || import.meta.env.VITE_EXPOSE_TEST_HANDLE === '1')
      ? (window as unknown as { __kubbForcedRankedSetup?: { preset: FieldPresetId; wind: boolean } }).__kubbForcedRankedSetup
      : undefined;
  if (forced) return forced;
  const ids = Object.keys(FIELD_PRESETS) as FieldPresetId[];
  return { preset: ids[Math.floor(random() * ids.length)], wind: random() < 0.5 };
}
