// Request helpers: client IP, origin checks (CSRF defence) and JSON parsing.
import { badRequest, forbidden } from "./errors.js";

export function clientIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * CSRF defence in depth: session cookies are SameSite=Lax and every
 * state-changing request must come from our own origin.
 */
export function assertSameOrigin(request) {
  const origin = request.headers.get("origin");
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && !["same-origin", "none"].includes(secFetchSite)) {
    throw forbidden("Cross-site requests are not allowed.", "CSRF");
  }
  if (!origin) return; // non-browser clients (no ambient cookies from other sites)
  const allowed = new Set();
  try {
    allowed.add(new URL(request.url).origin);
  } catch {}
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  if (host) {
    allowed.add(`${proto}://${host}`);
    allowed.add(`http://${host}`);
    allowed.add(`https://${host}`);
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      allowed.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
    } catch {}
  }
  if (!allowed.has(origin)) throw forbidden("Cross-site requests are not allowed.", "CSRF");
}

export async function readJson(request, { maxBytes = 2_000_000 } = {}) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > maxBytes) throw badRequest("Request body is too large.");
  try {
    const text = await request.text();
    if (text.length > maxBytes) throw badRequest("Request body is too large.");
    return text ? JSON.parse(text) : {};
  } catch (err) {
    if (err?.status) throw err;
    throw badRequest("Invalid JSON body.");
  }
}

export function appUrl(path = "") {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}
