import { describe, expect, it } from 'vitest';
import {
  appendChat,
  CHAT_HISTORY_MAX,
  CHAT_MAX_LENGTH,
  CHAT_MIN_INTERVAL_MS,
  ChatRateLimiter,
  sanitizeChatText,
  type ChatMessage
} from './chat';

/**
 * Le tchat est le SEUL contenu libre du protocole : tout le reste est
 * produit par le jeu lui-meme. Il arrive par un canal public dont le code de
 * salon est l'unique secret, donc rien ne garantit qu'un message vienne de
 * notre propre interface.
 *
 * Ces tests portent sur ce qui doit rester vrai du contenu, quoi qu'on
 * reçoive — pas sur l'apparence du panneau.
 */

const message = (id: number, text: string): ChatMessage => ({ id, mine: false, text });

describe('assainissement du texte', () => {
  it('coupe les espaces de bord et ramene les suites a un seul', () => {
    expect(sanitizeChatText('   bien    joue   ')).toBe('bien joue');
  });

  it('refuse ce qui ne contient rien d affichable', () => {
    for (const vide of ['', '   ', '\n\n', '\t', '\u0000\u001f']) {
      expect(sanitizeChatText(vide), JSON.stringify(vide)).toBe('');
    }
  });

  it('retire les retours a la ligne : un message tient sur une ligne', () => {
    // Sans cela, un seul `\n` suffirait a faire passer une bulle pour
    // plusieurs, et a pousser le reste de la conversation hors de l'ecran.
    expect(sanitizeChatText('salut\n\n\n\n\n\n\nca va ?')).toBe('salut ca va ?');
  });

  it('retire les marques de direction d ecriture', () => {
    // U+202E inverse visuellement l'ordre du texte affiche : garde, il
    // permettrait d'ecrire une chose et d'en afficher une autre.
    expect(sanitizeChatText('bien‮joue')).toBe('bienjoue');
    expect(sanitizeChatText('‏salut‎')).toBe('salut');
  });

  it('plafonne la longueur', () => {
    const long = 'a'.repeat(CHAT_MAX_LENGTH + 500);
    expect(sanitizeChatText(long)).toHaveLength(CHAT_MAX_LENGTH);
  });

  it('ne se laisse pas surprendre par autre chose qu une chaine', () => {
    // Le message vient du reseau : rien ne garantit son type.
    for (const bizarre of [null, undefined, 42, {}, []]) {
      expect(sanitizeChatText(bizarre as unknown as string)).toBe('');
    }
  });

  it('laisse intact un message normal, accents compris', () => {
    expect(sanitizeChatText('Bien joué ! 😄')).toBe('Bien joué ! 😄');
  });
});

describe('cadence des envois', () => {
  it('laisse passer le premier message', () => {
    expect(new ChatRateLimiter().accept(0)).toBe(true);
  });

  it('refuse un second message trop rapproche', () => {
    const c = new ChatRateLimiter();
    expect(c.accept(1000)).toBe(true);
    expect(c.accept(1000 + CHAT_MIN_INTERVAL_MS - 1)).toBe(false);
  });

  it('laisse passer une fois le delai ecoule', () => {
    const c = new ChatRateLimiter();
    c.accept(1000);
    expect(c.accept(1000 + CHAT_MIN_INTERVAL_MS)).toBe(true);
  });

  it('un refus ne repousse pas la prochaine autorisation', () => {
    // Sinon marteler le bouton repousserait indefiniment son propre droit a
    // parler — le joueur se trouverait puni d'avoir insiste.
    const c = new ChatRateLimiter();
    c.accept(0);
    for (let t = 100; t < CHAT_MIN_INTERVAL_MS; t += 100) c.accept(t);
    expect(c.accept(CHAT_MIN_INTERVAL_MS)).toBe(true);
  });

  it('allows() ne consomme rien', () => {
    const c = new ChatRateLimiter();
    expect(c.allows(0)).toBe(true);
    expect(c.allows(0)).toBe(true);
    expect(c.accept(0)).toBe(true);
  });
});

describe('journal borne', () => {
  it('garde les messages tant qu on reste sous la borne', () => {
    let journal: ChatMessage[] = [];
    for (let i = 0; i < 5; i += 1) journal = appendChat(journal, message(i, `m${i}`));
    expect(journal).toHaveLength(5);
    expect(journal[0].text).toBe('m0');
  });

  it('laisse tomber les plus anciens au-dela de la borne', () => {
    // Une partie peut durer ; la memoire ne doit pas suivre.
    let journal: ChatMessage[] = [];
    for (let i = 0; i < CHAT_HISTORY_MAX + 20; i += 1) journal = appendChat(journal, message(i, `m${i}`));
    expect(journal).toHaveLength(CHAT_HISTORY_MAX);
    expect(journal[journal.length - 1].text).toBe(`m${CHAT_HISTORY_MAX + 19}`);
    expect(journal[0].text).toBe('m20');
  });

  it('ne modifie pas le journal qu on lui donne', () => {
    const origine = [message(1, 'a')];
    appendChat(origine, message(2, 'b'));
    expect(origine).toHaveLength(1);
  });
});
