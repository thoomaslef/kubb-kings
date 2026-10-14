import { describe, expect, it } from 'vitest';
import { PSEUDO_MAX, PSEUDO_MIN, isForbiddenPseudo, validatePseudo } from './pseudo';

describe('validatePseudo : longueur et alphabet', () => {
  it('accepte des pseudos ordinaires', () => {
    for (const p of ['Thomas', 'Roi_du_Kubb', 'Le-Viking', 'Zoe42', 'Éloïse', 'abc', 'a'.repeat(PSEUDO_MAX)]) {
      expect(validatePseudo(p), p).toEqual({ ok: true, pseudo: p });
    }
  });

  it('retire les espaces autour', () => {
    expect(validatePseudo('  Viking  ')).toEqual({ ok: true, pseudo: 'Viking' });
  });

  it('refuse trop court / trop long', () => {
    expect(validatePseudo('ab')).toEqual({ ok: false, reason: 'too-short' });
    expect(validatePseudo('  a ')).toEqual({ ok: false, reason: 'too-short' });
    expect(validatePseudo('a'.repeat(PSEUDO_MAX + 1))).toEqual({ ok: false, reason: 'too-long' });
    expect(PSEUDO_MIN).toBeLessThan(PSEUDO_MAX);
  });

  it("refuse espaces, liens, adresses, symboles et caracteres de controle", () => {
    for (const p of ['Roi du Kubb', 'a@b.com', 'http://x.io', 'www.site.fr', '<b>gras</b>', 'Joueur!', 'a\nb', 'Jo$$', '🔥🔥🔥']) {
      expect(validatePseudo(p), p).toEqual({ ok: false, reason: expect.stringMatching(/chars|forbidden/) });
    }
  });
});

describe('isForbiddenPseudo', () => {
  it('refuse les termes interdits, avec accents et substitutions', () => {
    for (const p of ['Connard42', 'xX_putain_Xx', 'FUCKER', 'f_u_c_k', 'Enculé', 'm3rde', 'nigger', 'HITLER88', 'p0rn']) {
      expect(isForbiddenPseudo(p), p).toBe(true);
    }
  });

  it('refuse les termes courts comme mots entiers seulement', () => {
    expect(isForbiddenPseudo('pute')).toBe(true);
    expect(isForbiddenPseudo('Pute42')).toBe(true);
    expect(isForbiddenPseudo('sale_pd')).toBe(true);
    expect(isForbiddenPseudo('NTM')).toBe(true);
    expect(isForbiddenPseudo('cul-de-sac')).toBe(true);
  });

  it('ne bannit pas des mots courants qui les contiennent (le probleme de Scunthorpe)', () => {
    for (const p of ['Classic', 'Technique', 'Violet', 'Violon', 'Passion', 'Compute', 'Assassin', 'Nazir', 'Conan', 'Sexton', 'Biter', 'Pedro', 'Cumulus', 'Scunthorpe', 'Mishine']) {
      expect(isForbiddenPseudo(p), p).toBe(false);
    }
  });

  it("refuse les noms reserves (usurpation)", () => {
    for (const p of ['Admin', 'admin_42', 'Moderateur', 'KubbKings', 'support']) expect(isForbiddenPseudo(p), p).toBe(true);
    expect(isForbiddenPseudo('Administrateurs')).toBe(false);
  });
});
