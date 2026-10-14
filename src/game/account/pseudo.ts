/**
 * Le pseudo choisi par le joueur : ce qui est accepte, et ce qui ne l'est pas.
 *
 * Module PUR. Le serveur (`supabase/comptes.sql::set_pseudo`) applique les MEMES regles et fait
 * foi : ce fichier ne sert qu'a repondre tout de suite au joueur, sans aller-retour reseau.
 * Si l'un change, l'autre doit changer.
 *
 * Un pseudo est du texte LIBRE, affiche publiquement au classement — le jeu est ouvert a tous
 * les ages (cf. mentions legales). Le filtre ci-dessous est donc une premiere barriere, pas une
 * moderation complete :
 *   - longueur et alphabet restreints (lettres, chiffres, tiret, tiret bas : pas d'espace, de
 *     lien, d'adresse ni de symbole) ;
 *   - une liste de termes interdits, cherchee apres avoir ramene accents et substitutions
 *     courantes (0->o, 1->i, 3->e, 4->a, 5->s, @->a, $->s, 7->t) a des lettres. Les termes COURTS
 *     ne sont refuses que comme mot entier, pour ne pas bannir « Classic » a cause de « ass » ;
 *   - quelques noms reserves, contre l'usurpation.
 */

export const PSEUDO_MIN = 3;
export const PSEUDO_MAX = 16;

const ALLOWED = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9_-]+$/;

/**
 * Termes refuses ou qu'ils se trouvent dans le pseudo — assez longs et specifiques pour ne pas
 * se cacher dans un mot courant (pas « nique » : « technique » ; pas « viol » : « violet »).
 */
const FORBIDDEN_INSIDE: readonly string[] = [
  'connard', 'connasse', 'salope', 'salaud', 'putain', 'encule', 'enculer', 'merde', 'niquer', 'pedophile',
  'pedocriminel', 'violeur', 'hitler', 'negre', 'nigger', 'nigga', 'bougnoule', 'youpin', 'faggot', 'bitch',
  'whore', 'bastard', 'asshole', 'dickhead', 'fuck', 'shit', 'terroriste', 'porn', 'couille', 'branleur',
  'tagueule', 'suicide'
];

/** Termes courts : refuses seulement comme mot entier (un mot separe par _, - ou un chiffre). */
const FORBIDDEN_WHOLE: readonly string[] = [
  'pute', 'pd', 'fdp', 'ntm', 'tg', 'cul', 'sex', 'sexe', 'nique', 'con', 'ass', 'dick', 'cock', 'cunt', 'slut',
  'pedo', 'nazi', 'kkk', 'bite'
];

/** Noms reserves (usurpation) : refuses comme mot entier. */
const RESERVED: readonly string[] = ['admin', 'administrateur', 'moderateur', 'moderator', 'support', 'kubbkings', 'kubbking'];

const ACCENTS_FROM = 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ';
const ACCENTS_TO = 'aaaaaaceeeeiiiinooooouuuuyy';
const LEET_FROM = '01!345$@7';
const LEET_TO = 'oiieassat';

function stripAccents(text: string): string {
  let out = '';
  for (const ch of text) {
    const i = ACCENTS_FROM.indexOf(ch);
    out += i >= 0 ? ACCENTS_TO[i] : ch;
  }
  return out;
}

/** Le pseudo ramene a des lettres : minuscules, sans accents, substitutions courantes defaites. */
function leetLetters(text: string): string {
  let out = '';
  for (const ch of stripAccents(text.toLowerCase())) {
    const i = LEET_FROM.indexOf(ch);
    out += i >= 0 ? LEET_TO[i] : ch;
  }
  return out.replace(/[^a-z]/g, '');
}

/** Les mots du pseudo, separes par tout ce qui n'est pas une lettre (donc aussi par les chiffres). */
function words(text: string): string[] {
  return stripAccents(text.toLowerCase())
    .split(/[^a-z]+/)
    .filter((w) => w.length > 0);
}

/** true si le pseudo contient un terme interdit ou un nom reserve. */
export function isForbiddenPseudo(pseudo: string): boolean {
  const letters = leetLetters(pseudo);
  if (FORBIDDEN_INSIDE.some((w) => letters.includes(w))) return true;
  const tokens = [...words(pseudo), letters];
  return tokens.some((w) => FORBIDDEN_WHOLE.includes(w) || RESERVED.includes(w));
}

export type PseudoProblem = 'too-short' | 'too-long' | 'chars' | 'forbidden';

export type PseudoCheck = { ok: true; pseudo: string } | { ok: false; reason: PseudoProblem };

/** Verifie un pseudo saisi (espaces autour retires). */
export function validatePseudo(raw: string): PseudoCheck {
  const pseudo = raw.trim();
  if (pseudo.length < PSEUDO_MIN) return { ok: false, reason: 'too-short' };
  if (pseudo.length > PSEUDO_MAX) return { ok: false, reason: 'too-long' };
  if (!ALLOWED.test(pseudo)) return { ok: false, reason: 'chars' };
  if (isForbiddenPseudo(pseudo)) return { ok: false, reason: 'forbidden' };
  return { ok: true, pseudo };
}
