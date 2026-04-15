// Bump whenever the caching strategy or the list of pre-cached assets
// changes. Old clients will see a new version via the skipWaiting/claim
// pair below and immediately drop the previous cache.
const CACHE_NAME = 'kidquest-v3';
const ASSETS = ['/manifest.json'];

self.addEventListener('install', (event) => {
  // Activate the new worker as soon as installation finishes so users
  // don't stay stuck on a stale HTML shell referencing dead JS hashes.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Network-first for HTML navigations — this is what was breaking
  // updates: the previous cache-first strategy pinned users to whatever
  // `/index.html` they saw on their very first visit, and because the
  // HTML references hashed JS chunks, every new deploy 404'd for them.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req).catch(() => new Response('', { status: 504 }))
    );
    return;
  }
  // Everything else: cache-first with network fallback.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
