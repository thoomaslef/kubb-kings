import { describe, expect, it, vi } from 'vitest';
import { gameUrl, shareGame, type ShareData } from './shareLink';

const data: ShareData = { title: 'KUBB: Kings', text: 'Viens jouer', url: 'https://x.test/kubb-kings/' };

describe('gameUrl', () => {
  it('assemble l origine et la base, sans double barre', () => {
    expect(gameUrl('https://thoomaslef.github.io', '/kubb-kings/')).toBe('https://thoomaslef.github.io/kubb-kings/');
    expect(gameUrl('https://thoomaslef.github.io/', '/kubb-kings/')).toBe('https://thoomaslef.github.io/kubb-kings/');
    expect(gameUrl('http://localhost:5173', '/')).toBe('http://localhost:5173/');
    expect(gameUrl('http://localhost:5173', 'sans-barre/')).toBe('http://localhost:5173/sans-barre/');
  });

  it('ne porte jamais de parametre : pas de code de salon, de session ou de retour de connexion', () => {
    expect(gameUrl('https://a.test', '/jeu/')).not.toMatch(/[?#]/);
  });
});

describe('shareGame', () => {
  it('utilise le partage natif quand il existe', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    expect(await shareGame(data, { share, writeText })).toBe('shared');
    expect(share).toHaveBeenCalledWith(data);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('un partage ferme par le joueur n est pas une panne : rien n est copie', async () => {
    const abort = Object.assign(new Error('annule'), { name: 'AbortError' });
    const writeText = vi.fn();
    expect(await shareGame(data, { share: vi.fn().mockRejectedValue(abort), writeText })).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('un partage natif qui echoue autrement retombe sur la copie', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareGame(data, { share: vi.fn().mockRejectedValue(new Error('boum')), writeText })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(data.url);
  });

  it('sans partage natif (ordinateur) : copie du lien seul', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareGame(data, { writeText })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://x.test/kubb-kings/');
  });

  it('presse-papiers refuse : on affiche le lien pour qu il le copie lui-meme', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('refuse'));
    expect(await shareGame(data, { writeText })).toBe('manual');
  });

  it('rien de disponible : repli manuel', async () => {
    expect(await shareGame(data, {})).toBe('manual');
  });
});
