/**
 * Partager le lien du jeu avec un ami.
 *
 * Module sans React ni DOM direct : les capacites du navigateur (`share`,
 * `clipboard`) sont INJECTEES, pour que chaque branche se teste sans
 * navigateur (shareLink.test.ts) — le partage natif, la copie, et le cas ou
 * rien n'est disponible.
 */

export interface ShareData {
  title: string;
  text: string;
  url: string;
}

/** Adresse du jeu, sans parametre : jamais un code de salon, une session ou un retour d'authentification. */
export function gameUrl(origin: string, baseUrl: string): string {
  const base = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`;
  return `${origin.replace(/\/+$/, '')}${base}`;
}

export interface ShareEnv {
  share?: (data: ShareData) => Promise<void>;
  writeText?: (text: string) => Promise<void>;
}

/**
 * - `shared` : la feuille de partage du systeme s'est ouverte et a abouti ;
 * - `copied` : pas de partage natif (ordinateur) : le lien est dans le presse-papiers ;
 * - `cancelled` : le joueur a ferme la feuille de partage — rien a annoncer ;
 * - `manual` : ni l'un ni l'autre : on affiche le lien pour qu'il le copie lui-meme.
 */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'manual';

export async function shareGame(data: ShareData, env: ShareEnv): Promise<ShareOutcome> {
  if (env.share) {
    try {
      await env.share(data);
      return 'shared';
    } catch (error) {
      // Fermer la feuille de partage leve une AbortError : ce n'est pas une panne.
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
      // Toute autre erreur : on retombe sur la copie plutot que de ne rien faire.
    }
  }
  if (env.writeText) {
    try {
      await env.writeText(data.url);
      return 'copied';
    } catch {
      // Presse-papiers refuse (page non securisee, permission) : repli manuel.
    }
  }
  return 'manual';
}
