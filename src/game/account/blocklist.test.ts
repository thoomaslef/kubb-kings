import { beforeEach, describe, expect, it } from 'vitest';
import { blockPseudo, loadBlocked, MAX_BLOCKED, unblockAll, withoutBlocked } from './blocklist';

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
  };
});

describe('joueurs bloques', () => {
  it('bloque sans tenir compte de la casse, et se souvient', () => {
    blockPseudo('  Vilain_Un ');
    expect(loadBlocked()).toEqual(['vilain_un']);
    blockPseudo('VILAIN_UN');
    expect(loadBlocked()).toEqual(['vilain_un']);
  });

  it('masque les lignes bloquees et garde les autres', () => {
    const rows = [{ pseudo: 'Vilain_Un' }, { pseudo: 'Gentil' }];
    expect(withoutBlocked(rows, blockPseudo('vilain_un')).map((r) => r.pseudo)).toEqual(['Gentil']);
    expect(withoutBlocked(rows, [])).toEqual(rows);
  });

  it('tout debloquer', () => {
    blockPseudo('x_y_z');
    expect(unblockAll()).toEqual([]);
    expect(loadBlocked()).toEqual([]);
  });

  it('borne la liste', () => {
    for (let i = 0; i < MAX_BLOCKED + 20; i += 1) blockPseudo(`joueur_${i}`);
    const list = loadBlocked();
    expect(list.length).toBe(MAX_BLOCKED);
    expect(list[list.length - 1]).toBe(`joueur_${MAX_BLOCKED + 19}`);
  });

  it('un stockage corrompu ne fait rien planter', () => {
    mem.set('kubb-kings.blocked-pseudos', '{pas du json');
    expect(loadBlocked()).toEqual([]);
    mem.set('kubb-kings.blocked-pseudos', '[1, "ok", null]');
    expect(loadBlocked()).toEqual(['ok']);
  });
});
