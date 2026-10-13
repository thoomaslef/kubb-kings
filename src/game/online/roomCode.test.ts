import { describe, expect, it } from 'vitest';
import { createRoomCode } from './localTransport';

describe('createRoomCode', () => {
  it('5 caracteres lisibles par defaut, sans I/O/0/1', () => {
    for (let i = 0; i < 200; i += 1) expect(createRoomCode()).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
  });

  it('longueur et hasard injectables', () => {
    expect(createRoomCode(10)).toHaveLength(10);
    expect(createRoomCode(3, () => 0)).toBe('AAA');
    expect(createRoomCode(2, () => 0.999999)).toBe('99');
  });

  it("n'est pas constant (le hasard par defaut varie)", () => {
    const codes = new Set(Array.from({ length: 50 }, () => createRoomCode(8)));
    expect(codes.size).toBeGreaterThan(45);
  });
});
