import { DICTS } from './dictionaries';

export type Lang = 'fr' | 'en';

/**
 * Fonction de traduction pure : utilisable depuis un composant React (via le
 * hook useT ci-a-cote) mais aussi depuis le code du jeu (MatchScene dessine
 * du texte directement sur le canevas Phaser, hors de tout rendu React).
 *
 * `params` remplace `{cle}` dans la chaine — utilise pour les quelques
 * textes avec un nombre variable (ex. numero de manche).
 */
export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const dict = DICTS[lang];
  let text = dict[key] ?? DICTS.fr[key] ?? key;

  if (params) {
    for (const [name, value] of Object.entries(params)) {
      // Pas de String.prototype.replaceAll : hors du lib ES2020 du projet.
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}
