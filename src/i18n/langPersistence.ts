import type { Lang } from './translate';

/**
 * Preference de langue, sur le meme modele que tutorial.ts : localStorage
 * peut jeter (navigation privee, site data bloque), chaque acces est donc
 * protege.
 */
const KEY = 'kubb-kings.lang';

function readStored(): Lang | null {
  try {
    const value = window.localStorage?.getItem(KEY);
    return value === 'fr' || value === 'en' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Preference enregistree, sinon detectee depuis la langue du navigateur
 * (anglais si le navigateur est en anglais, francais par defaut sinon —
 * coherent avec un jeu francophone a l'origine), sinon francais.
 */
export function getInitialLang(): Lang {
  try {
    const stored = readStored();
    if (stored) return stored;
    return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}

export function persistLang(lang: Lang) {
  try {
    window.localStorage?.setItem(KEY, lang);
  } catch {
    // La preference ne survivra pas au rechargement, sans consequence sur le jeu.
  }
}
