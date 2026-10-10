/**
 * Connexion par Google : proposee au joueur SEULEMENT quand elle fonctionne.
 *
 * Le bouton existe dans le code, mais il ne marche que si Google ET Supabase ont ete
 * configures a la main (docs/comptes-joueurs.md, « Connexion avec Google »). Tant que
 * ce n'est pas fait, un bouton visible renverrait le joueur sur une page d'erreur
 * brute de Supabase — pire que pas de bouton. Il reste donc cache.
 *
 * Une fois Google configure : passer `GOOGLE_READY` a `true` (une seule ligne). Un build
 * peut aussi l'activer sans toucher au code avec `VITE_GOOGLE_AUTH=1` (c'est ce que fait
 * la verification `npm run test:comptes`).
 */
const GOOGLE_READY = false;

export const GOOGLE_SIGN_IN_ENABLED: boolean = GOOGLE_READY || import.meta.env.VITE_GOOGLE_AUTH === '1';
