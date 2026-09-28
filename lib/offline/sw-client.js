// Browser helpers for talking to the service worker (public/sw.js).

export function swEnabled() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  // On by default in development and production. Set NEXT_PUBLIC_DISABLE_OFFLINE=true to turn it off.
  return process.env.NEXT_PUBLIC_DISABLE_OFFLINE !== "true";
}

export function swUrl() {
  return process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev=1";
}

/** Scripts/styles the current page has loaded, so they are available offline too. */
export function loadedAssets() {
  const urls = new Set();
  try {
    for (const e of performance.getEntriesByType("resource")) {
      const u = new URL(e.name);
      if (u.origin === location.origin && u.pathname.startsWith("/_next/static/")) urls.add(u.pathname + u.search);
    }
  } catch {}
  document.querySelectorAll('script[src^="/_next/static/"], link[href^="/_next/static/"]').forEach((el) => urls.add(el.getAttribute("src") || el.getAttribute("href")));
  return [...urls];
}

/** Ask the service worker to save pages (and everything they need) for offline use. */
export async function warmOffline(pages = [], { refresh = true } = {}) {
  if (!swEnabled() || !navigator.onLine) return false;
  try {
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 10000))]);
    const worker = reg?.active;
    if (!worker) return false;
    worker.postMessage({ type: "warm", pages, refresh, assets: loadedAssets() });
    return true;
  } catch {
    return false;
  }
}
