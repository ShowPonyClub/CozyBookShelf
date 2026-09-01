/* Tatties — service worker (testversie).
   Strategie: NETWORK-FIRST voor navigaties (de app-HTML), mét deadlines (PLAT-12):
   - Online  → nieuwste build; maar trage headers (>3.5s) of een GESTALDE download
               (>20s voor de hele body) vallen terug op de laatst gecachte build.
               Zonder deadlines kan een hangende stream de pagina eindeloos in
               'loading' houden. Het netwerk raast op de achtergrond uit en ververst
               dan alsnog de cache.
   - Offline → laatst gecachte build, zodat de app ook zonder netwerk laadt.
   De app toont zelf een 'nieuwe versie'-toast zodra een nieuwe SW de pagina overneemt
   (controllerchange na skipWaiting+claim; zie de registratie in tatties-3d.html).
   Cachenaam is geversioneerd; bij activatie worden oude caches opgeruimd.
   Bump CACHE bij elke release (gelijk aan APP_VERSIE in tatties-3d.html). */
const CACHE = 'tatties-test-v0.3.9';
const NET_TIMEOUT_MS = 3500;     // deadline op de response-headers
const BODY_TIMEOUT_MS = 20000;   // deadline op de volledige body (app is ~3.5MB)

function metDeadline(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('deadline')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

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

  // Navigaties (de HTML zelf): network-first met deadlines + cache-fallback.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const netP = fetch(req);
      try {
        const net = await metDeadline(netP, NET_TIMEOUT_MS);
        // Alleen geslaagde responses cachen: een tijdelijke 404/500 mag de
        // laatste goede build niet overschrijven en offline geserveerd worden.
        if (!net.ok) return net;
        // Redirect-responses niet herbouwen/cachen (uit de SW serveren voor een
        // navigatie geeft dan een security-fout): direct doorgeven.
        if (net.redirected) return net;
        // Body volledig bufferen mét deadline: pas dan weten we zeker dat de stream
        // niet halverwege stokt. Daarna één kopie naar de cache, één naar de browser.
        const buf = await metDeadline(net.arrayBuffer(), BODY_TIMEOUT_MS);
        const resp = new Response(buf, { status: net.status, statusText: net.statusText, headers: net.headers });
        const cache = await caches.open(CACHE);
        await cache.put(req, resp.clone());
        return resp;
      } catch {
        // Traag/gestald/offline -> gecachte build. Laat het netwerk op de achtergrond
        // uitrazen zodat een trage download alsnog de cache ververst voor de volgende
        // start (alleen als de body nog niet (deels) geconsumeerd is).
        e.waitUntil(netP.then(async (n) => {
          if (n && n.ok && !n.redirected && !n.bodyUsed) {
            const c = await caches.open(CACHE);
            await c.put(req, n.clone());
          }
        }).catch(() => { /* offline */ }));
        const cached = (await caches.match(req))
                    || (await caches.match('./index.html'))
                    || (await caches.match('./'));
        if (cached) return cached;
        // Geen cache (eerste bezoek op een traag netwerk): dan toch op het netwerk
        // wachten - laat tonen is beter dan niets tonen.
        try { return await netP; } catch { return Response.error(); }
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
