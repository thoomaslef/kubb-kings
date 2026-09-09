/**
 * Service worker du jeu : rend KUBB: Kings jouable hors ligne une fois la
 * page ouverte une premiere fois.
 *
 * Deux strategies, choisies pour qu'un nouveau deploiement ne reste jamais
 * coince derriere un cache :
 *
 * - Navigation (index.html) : reseau d'abord. En ligne on recoit toujours la
 *   derniere version, qui pointe vers les derniers assets ; hors ligne on
 *   retombe sur la copie en cache.
 * - Assets : cache d'abord. Vite leur donne un nom hashe, donc un fichier
 *   servi une fois ne changera plus jamais de contenu — le cache est sur.
 */

const CACHE = 'kubb-kings-v1';

/** Racine servie par ce worker : "/" en local, "/kubb-kings/" sur Pages. */
const ROOT = new URL('./', self.registration.scope).pathname;

/**
 * Precharge la coquille de l'app : index.html, puis les assets qu'il reference.
 *
 * Ce worker est un fichier statique de public/ : il ne connait pas les noms
 * hashes que Vite genere a chaque build. Il les lit donc dans le HTML, ce qui
 * le garde correct sans etape de build supplementaire.
 */
async function precacheShell() {
  const cache = await caches.open(CACHE);
  const response = await fetch(`${ROOT}index.html`, { cache: 'reload' });
  if (!response.ok) return;

  const html = await response.clone().text();
  await cache.put(`${ROOT}index.html`, response);

  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => new URL(match[1], self.registration.scope).pathname)
    .filter((path) => path.startsWith(`${ROOT}assets/`));

  await cache.addAll([...new Set(assets)]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    precacheShell()
      .catch(() => {
        /* premiere visite hors ligne : rien a precharger, on continue */
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // On ne touche ni aux requetes non-GET ni aux domaines tiers.
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(`${ROOT}index.html`, copy));
          return response;
        })
        .catch(() => caches.match(`${ROOT}index.html`).then((cached) => cached ?? Response.error()))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Une reponse partielle ou opaque n'a rien a faire en cache.
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
