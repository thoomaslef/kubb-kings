import { beforeEach, describe, expect, it } from 'vitest';
import { clearSavedRun, loadSavedRun, saveRun, savedRunStageNumber } from './runSave';
import { LADDER } from './roguelite';

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k)
    }
  };
});

describe('sauvegarde de la run du Defi', () => {
  it('relit ce qu on a ecrit', () => {
    saveRun({ run: { stageIndex: 4, perks: ['bras-vif'], sursisUsed: true }, perkPending: false });
    const lu = loadSavedRun();
    expect(lu?.run).toEqual({ stageIndex: 4, perks: ['bras-vif'], sursisUsed: true });
    expect(lu?.perkPending).toBe(false);
  });

  it('numero de manche : la manche a jouer, ou celle qui suit le bonus a choisir', () => {
    expect(savedRunStageNumber({ run: { stageIndex: 4, perks: [], sursisUsed: false }, perkPending: false })).toBe(5);
    expect(savedRunStageNumber({ run: { stageIndex: 4, perks: [], sursisUsed: false }, perkPending: true })).toBe(6);
  });

  it('effacer', () => {
    saveRun({ run: { stageIndex: 1, perks: [], sursisUsed: false }, perkPending: true });
    clearSavedRun();
    expect(loadSavedRun()).toBeNull();
  });

  it('ignore tout ce qui est abime ou truque', () => {
    const k = 'kubb-kings.defi-run';
    for (const mauvais of [
      '{pas du json',
      'null',
      '{"run":null}',
      JSON.stringify({ run: { stageIndex: -1, perks: [], sursisUsed: false } }),
      JSON.stringify({ run: { stageIndex: LADDER.length, perks: [], sursisUsed: false } }),
      JSON.stringify({ run: { stageIndex: 1.5, perks: [], sursisUsed: false } }),
      JSON.stringify({ run: { stageIndex: 2, perks: ['inconnu'], sursisUsed: false } }),
      JSON.stringify({ run: { stageIndex: 2, perks: ['bras-vif', 'bras-vif'], sursisUsed: false } }),
      JSON.stringify({ run: { stageIndex: 2, perks: 'bras-vif', sursisUsed: false } })
    ]) {
      mem.set(k, mauvais);
      expect(loadSavedRun(), mauvais).toBeNull();
    }
  });
});
