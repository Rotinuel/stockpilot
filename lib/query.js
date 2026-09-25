// Helpers for reading common query-string parameters safely.
import { resolveRange } from "../utils/dates.js";

export function rangeFromSearch(searchParams, tz, fallback = "this_month") {
  const get = (k) => (typeof searchParams?.get === "function" ? searchParams.get(k) : searchParams?.[k]);
  const preset = get("range") || fallback;
  return resolveRange(preset, { from: get("from"), to: get("to"), tz });
}

export function optionalDateRange(searchParams, tz) {
  const get = (k) => (typeof searchParams?.get === "function" ? searchParams.get(k) : searchParams?.[k]);
  if (!get("range") && !get("from")) return {};
  const r = rangeFromSearch(searchParams, tz);
  return { from: r.from, to: r.to };
}

export function str(searchParams, key, max = 100) {
  const get = typeof searchParams?.get === "function" ? searchParams.get(key) : searchParams?.[key];
  if (get === null || get === undefined) return undefined;
  const v = String(Array.isArray(get) ? get[0] : get).trim();
  return v ? v.slice(0, max) : undefined;
}

export function pageParams(searchParams, defaultLimit = 20) {
  const page = Math.max(1, parseInt(str(searchParams, "page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(str(searchParams, "limit") || String(defaultLimit), 10) || defaultLimit));
  return { page, limit };
}
