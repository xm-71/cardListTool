/* Service worker: the app works offline after one online visit.
 * The build fills in VERSION and PRECACHE (see vite.config.ts). Card art is cached as it is seen, and the
 * Options screen can download all of it ahead of time into the same cache. */
const VERSION = '__VERSION__';
const SHELL = `shell-${VERSION}`;
const ART = 'art-v1';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('shell-') && key !== SHELL) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

async function art(request) {
  const cache = await caches.open(ART);
  const hit = await cache.match(request.url, { ignoreVary: true });
  if (hit) return hit;
  try {
    // A CORS request gives a normal (not opaque) response, which costs little storage.
    const response = await fetch(request.url, { mode: 'cors' });
    if (response.ok) await cache.put(request.url, response.clone());
    return response;
  } catch {
    return Response.error(); // the card shows its text version instead
  }
}

async function navigation(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(SHELL);
    cache.put('/index.html', response.clone());
    return response;
  } catch {
    const cache = await caches.open(SHELL);
    return (
      (await cache.match('/index.html', { ignoreVary: true })) ??
      (await cache.match('/', { ignoreVary: true })) ??
      Response.error()
    );
  }
}

async function asset(request) {
  const cache = await caches.open(SHELL);
  // Some servers send `Vary: Origin`, and module scripts carry an Origin header the precache request did not.
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.hostname === 'assets.tcgdex.net') event.respondWith(art(request));
  else if (url.origin !== self.location.origin) return;
  else if (request.mode === 'navigate') event.respondWith(navigation(request));
  else event.respondWith(asset(request));
});
