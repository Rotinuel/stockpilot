// Fixed-window rate limiter.
// The default in-memory store is per-instance; for multi-instance deployments
// implement the same interface backed by Redis/Upstash and call setRateLimitStore().

class MemoryStore {
  constructor() {
    this.hits = new Map();
  }
  async increment(key, windowMs) {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.hits.set(key, fresh);
      if (this.hits.size > 10_000) this.sweep(now);
      return fresh;
    }
    entry.count += 1;
    return entry;
  }
  async peek(key) {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= Date.now()) return { count: 0, resetAt: 0 };
    return entry;
  }
  async reset(key) {
    this.hits.delete(key);
  }
  sweep(now) {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}

let store = globalThis.__spRateStore || (globalThis.__spRateStore = new MemoryStore());

export function setRateLimitStore(custom) {
  store = custom;
}

/**
 * @param {string} key e.g. "login:1.2.3.4"
 * @param {{limit:number, windowMs:number}} opts
 * @returns {Promise<{ok:boolean, remaining:number, resetAt:number}>}
 */
export async function rateLimit(key, { limit, windowMs }) {
  const entry = await store.increment(key, windowMs);
  return { ok: entry.count <= limit, remaining: Math.max(0, limit - entry.count), resetAt: entry.resetAt };
}

/** Has `key` already reached `limit` (without counting this request)? */
export async function isLimited(key, { limit }) {
  const entry = await store.peek(key);
  return { limited: entry.count >= limit, resetAt: entry.resetAt };
}

/** Count one event (e.g. a FAILED login) against `key`. */
export async function recordHit(key, { windowMs }) {
  return store.increment(key, windowMs);
}

export async function clearHits(key) {
  if (store.reset) await store.reset(key);
}

export const RATE_LIMITS = {
  // Only FAILED sign-ins count towards this (successful logins never lock you out).
  loginFailures: { limit: 20, windowMs: 15 * 60 * 1000 },
  auth: { limit: 30, windowMs: 15 * 60 * 1000 },
  register: { limit: 20, windowMs: 60 * 60 * 1000 },
  passwordReset: { limit: 5, windowMs: 60 * 60 * 1000 },
  api: { limit: 300, windowMs: 60 * 1000 },
  checkout: { limit: 10, windowMs: 10 * 60 * 1000 },
};
