/* Tatties — service worker (testversie).
   Strategie: NETWORK-FIRST voor navigaties (de app-HTML).
   - Online  → altijd de nieuwste build (netwerk eerst), kopie in cache.
   - Offline → laatst gecachte build, zodat de app ook zonder netwerk laadt.
   Cachenaam is geversioneerd; bij activatie worden oude caches opgeruimd.
   Bump CACHE bij een breaking change om alle clients te verversen. */
const CACHE = 'tatties-test-v0.2.9.11';   // bump bij elke release (gelijk aan APP_VERSIE in tatties-3d.html)

self.addEventListener('install', () => {
  // Nieuwe SW niet laten wachten op het sluiten van oude tabs.
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();   // bestaande tabs meteen onder controle van deze SW
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Alleen same-origin GET behandelen; de rest ongemoeid laten.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Navigaties (de HTML zelf): network-first met cache-fallback.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        // Alleen geslaagde responses cachen: een tijdelijke 404/500 mag de
        // laatste goede build niet overschrijven en offline geserveerd worden.
        if (net.ok) { const cache = await caches.open(CACHE); cache.put(req, net.clone()); }
        return net;
      } catch {
        // Offline: gecachte versie van dit pad, anders de gecachte index.
        return (await caches.match(req))
            || (await caches.match('./index.html'))
            || (await caches.match('./'))
            || Response.error();
      }
    })());
    return;
  }

  // Overige same-origin GET's (zeldzaam — alles zit inline): cache-first, netwerk vult aan.
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const net = await fetch(req);
      if (net.ok) { const cache = await caches.open(CACHE); cache.put(req, net.clone()); }
      return net;
    } catch {
      return Response.error();
    }
  })());
});
