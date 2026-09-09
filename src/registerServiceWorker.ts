/**
 * Enregistre le service worker qui rend le jeu jouable hors ligne.
 *
 * Uniquement en production : en dev, un worker qui met les assets en cache
 * masquerait le hot reload de Vite.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* Le hors-ligne n'est qu'un bonus : le jeu tourne sans. */
    });
  });
}
