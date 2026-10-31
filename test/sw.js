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
const CACHE = 'tatties-test-v0.5.14';
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
    // Alleen de eigen caches opruimen (2026-10-09): /test/ en /web/ delen het domein en dus de Cache API; zonder prefix gooide
    // de ene service worker bij elke update de cache van de andere weg.
    const PREFIX = CACHE.replace(/v[\d.]+$/, '');
    const oud = namen.filter((n) => n.startsWith(PREFIX) && n !== CACHE);
    // review R3 AC-1: eerst de laatst gecachte pagina('s) meenemen naar de nieuwe cache, pas dan de oude wissen. De nieuwe cache is
    // bij activeren nog leeg (alleen een navigatie vult hem), dus zonder deze stap was de app na elke update offline weg.
    // Nieuwste oude cache eerst; sleutels met een query (oude ?code=-items) niet meenemen.
    if (oud.length) {
      try {
        const nieuw = await caches.open(CACHE);
        for (const n of oud.slice().reverse()) {
          try {
            const c = await caches.open(n);
            for (const k of await c.keys()) {
              if (new URL(k.url).search) continue;
              if (await nieuw.match(k)) continue;
              const r = await c.match(k);
              if (r) await nieuw.put(k, r);
            }
          } catch { /* deze cache overslaan */ }
        }
      } catch { /* geen Cache API-ruimte: dan alleen opruimen */ }
    }
    await Promise.all(oud.map((n) => caches.delete(n)));
    await self.clients.claim();   // bestaande tabs meteen onder controle van deze SW
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Alleen same-origin GET behandelen; de rest ongemoeid laten.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Navigaties (de HTML zelf): network-first met deadlines + cache-fallback.
  if (req.mode === 'navigate') {
    // Cachesleutel zonder query/hash (security-audit 2026-10-09): de PKCE-code uit een mail-link (?code=) hoort niet in CacheStorage;
    // alle varianten van de pagina delen zo een cache-item.
    const u = new URL(req.url), sleutel = new Request(u.origin + u.pathname);
    e.respondWith((async () => {
      const netP = fetch(req);
      // review R3 AC-1: de body-download (bufP) bewaren. Na een deadline loopt hij op de achtergrond door en vult hij alsnog de
      // cache (voorheen sloeg dat over omdat de body al 'gebruikt' was), en zonder cache wachten we erop in plaats van een
      // Response met een gebruikte body terug te geven (= foutpagina).
      let net = null, bufP = null;
      const kopie = (n, buf) => new Response(buf, { status: n.status, statusText: n.statusText, headers: n.headers });
      const bewaar = async (n, buf) => { try { const c = await caches.open(CACHE); await c.put(sleutel, kopie(n, buf)); } catch { /* vol */ } };
      try {
        net = await metDeadline(netP, NET_TIMEOUT_MS);
        // Alleen geslaagde responses cachen: een tijdelijke 404/500 mag de
        // laatste goede build niet overschrijven en offline geserveerd worden.
        // review R3 AC-1: bij een serverfout (5xx) liever de gecachte pagina dan een kale foutpagina (een 404 blijft een 404).
        if (!net.ok) return (net.status >= 500 && await caches.match(sleutel)) || net;
        // Redirect-responses niet herbouwen/cachen (uit de SW serveren voor een
        // navigatie geeft dan een security-fout): direct doorgeven.
        if (net.redirected) return net;
        // Body volledig bufferen mét deadline: pas dan weten we zeker dat de stream
        // niet halverwege stokt. Daarna één kopie naar de cache, één naar de browser.
        bufP = net.arrayBuffer();
        const buf = await metDeadline(bufP, BODY_TIMEOUT_MS);
        await bewaar(net, buf);
        return kopie(net, buf);
      } catch {
        // Traag/gestald/offline -> gecachte build. Laat het netwerk op de achtergrond
        // uitrazen zodat een trage download alsnog de cache ververst voor de volgende
        // start (alleen als de body nog niet (deels) geconsumeerd is).
        // review R3 AC-1: dezelfde download (bufP) afmaken in plaats van opnieuw aan de body te beginnen.
        const achter = (async () => {
          const n = net || await netP;
          if (!n || !n.ok || n.redirected) return null;
          const buf = await (bufP || (bufP = n.arrayBuffer()));
          return { n, buf };
        })();
        e.waitUntil(achter.then((r) => r && bewaar(r.n, r.buf)).catch(() => { /* offline */ }));
        const cached = (await caches.match(sleutel))
                    || (await caches.match('./index.html'))
                    || (await caches.match('./'));
        if (cached) return cached;
        // Geen cache (eerste bezoek op een traag netwerk): dan toch op het netwerk
        // wachten - laat tonen is beter dan niets tonen.
        try { const r = await achter; if (r) return kopie(r.n, r.buf); } catch { /* offline of afgebroken */ }
        try { return await netP; } catch { return Response.error(); }   // 4xx/5xx of redirect: body nog ongebruikt
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
