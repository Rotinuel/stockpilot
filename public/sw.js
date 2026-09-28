/* StockPilot service worker — keeps the app usable offline.
 *  • /_next/static/* and icons: cache-first in production (files are content-hashed),
 *    network-first in development (registered as /sw.js?dev=1) so code changes show up
 *  • pages (navigations): network-first; if the network fails or is very slow the last
 *    saved copy is served, otherwise the /offline page
 *  • the app asks the worker to "warm" key pages (POS, dashboard…) together with every
 *    script/stylesheet they need, so they open offline even if never visited after install
 *  • product/logo images (/api/assets/*) are cached; other API calls never are
 *    (the POS keeps its own offline data in IndexedDB)
 * Page and image caches start with "sp-pages" so logging out can wipe them.
 */
const VERSION = "v2";
const DEV = new URL(self.location.href).searchParams.get("dev") === "1";
const STATIC_CACHE = `sp-static-${VERSION}`;
const PAGE_CACHE = `sp-pages-${VERSION}`;
const IMAGE_CACHE = `sp-pages-img-${VERSION}`;
const KEEP = [STATIC_CACHE, PAGE_CACHE, IMAGE_CACHE];
const PRECACHE = ["/logo.svg", "/icon-192.png", "/icon-512.png", "/site.webmanifest"];
const NAV_TIMEOUT_MS = 7000; // after this, serve the saved page if we have one
const MATCH = { ignoreVary: true, ignoreSearch: false };

const isStatic = (url) => url.pathname.startsWith("/_next/static/") || /\.(?:png|jpe?g|svg|ico|webp|gif|woff2?|css|js|webmanifest)$/.test(url.pathname);

/** Every same-origin /_next/static/… URL referenced by an HTML page (script tags, CSS links and RSC payload). */
function assetUrls(html) {
  const out = new Set();
  const re = /\/_next\/static\/[^"'\\\s)<>]+/g;
  let m;
  while ((m = re.exec(html))) out.add(m[0].replace(/&amp;/g, "&"));
  return [...out];
}

async function cacheAssets(urls) {
  const cache = await caches.open(STATIC_CACHE);
  await Promise.all(
    urls.map(async (u) => {
      try {
        if (!DEV && (await cache.match(u))) return;
        const res = await fetch(u, { credentials: "same-origin" });
        if (res.ok) await cache.put(u, res);
      } catch {}
    }),
  );
}

async function savePage(pathname, res) {
  const type = res.headers.get("content-type") || "";
  if (!res.ok || res.redirected || res.type !== "basic" || !type.includes("text/html")) return false;
  const cache = await caches.open(PAGE_CACHE);
  await cache.put(pathname, res);
  return true;
}

/** Download pages (with the user's cookie) and everything they need to render. */
async function warm(pages = [], assets = [], refresh = true) {
  const found = new Set(assets);
  const pageCache = await caches.open(PAGE_CACHE);
  for (const p of pages) {
    try {
      if (!refresh && (await pageCache.match(new URL(p, self.location.origin).pathname, MATCH))) continue;
      const res = await fetch(p, { credentials: "same-origin", redirect: "follow", headers: { Accept: "text/html" } });
      const copy = res.clone();
      if (await savePage(new URL(p, self.location.origin).pathname, res)) assetUrls(await copy.text()).forEach((u) => found.add(u));
    } catch {}
  }
  await cacheAssets([...found].filter((u) => u.startsWith("/") || u.startsWith(self.location.origin)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.all(PRECACHE.map((u) => cache.add(u).catch(() => null)));
      await warm(["/offline"]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("sp-") && !KEEP.includes(k)).map((k) => caches.delete(k)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.disable().catch(() => null);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data === "clear-pages" || data.type === "clear-pages") {
    event.waitUntil(Promise.all([caches.delete(PAGE_CACHE), caches.delete(IMAGE_CACHE)]));
  } else if (data === "skip-waiting") {
    self.skipWaiting();
  } else if (data.type === "warm") {
    const pages = (data.pages || []).filter((p) => typeof p === "string" && p.startsWith("/") && !p.startsWith("/api/"));
    const assets = (data.assets || []).filter((a) => typeof a === "string");
    const job = warm(pages, assets, data.refresh !== false).then(() => event.source?.postMessage?.({ type: "warmed", pages }));
    event.waitUntil(job);
  }
});

function staticResponse(event, req) {
  if (DEV) {
    // Network first so code changes are never hidden; cached copy only when offline.
    return fetch(req)
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.put(req, copy)));
        }
        return res;
      })
      .catch(async () => (await caches.match(req, MATCH)) || Response.error());
  }
  return caches.match(req, MATCH).then(
    (hit) =>
      hit ||
      fetch(req).then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.put(req, copy)));
        }
        return res;
      }),
  );
}

async function pageResponse(event, req, url) {
  const cache = await caches.open(PAGE_CACHE);
  const saved = await cache.match(url.pathname, MATCH);
  const network = fetch(req).then((res) => {
    const copy = res.clone();
    event.waitUntil(savePage(url.pathname, copy).catch(() => null));
    return res;
  });
  network.catch(() => null); // avoid unhandled rejections when the cached copy wins
  let timer;
  const slow = saved ? new Promise((resolve) => (timer = setTimeout(() => resolve(saved), NAV_TIMEOUT_MS))) : null;
  try {
    const res = await (slow ? Promise.race([network, slow]) : network);
    return res;
  } catch {
    if (saved) return saved;
    return (await caches.match("/offline", MATCH)) || new Response("<h1>You're offline</h1><p>Reconnect and try again.</p>", { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Uploaded images: immutable, so cache-first.
  if (/^\/api\/assets\/[a-f0-9]{24}$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const hit = await cache.match(req, MATCH);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) event.waitUntil(cache.put(req, res.clone()));
          return res;
        } catch {
          return Response.error();
        }
      }),
    );
    return;
  }
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/sw.js" || url.pathname.startsWith("/_next/webpack-hmr") || url.pathname.startsWith("/__nextjs")) return;

  if (req.mode === "navigate") {
    event.respondWith(pageResponse(event, req, url));
    return;
  }
  // Client-side navigations fetch RSC data; when offline they fail and Next.js falls back
  // to a full page load, which the navigation handler above answers from the cache.
  if (req.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  if (isStatic(url)) event.respondWith(staticResponse(event, req));
});
