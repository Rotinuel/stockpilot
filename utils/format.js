// Display formatting helpers (client + server safe).
export { formatMoney } from "../lib/money.js";

export function formatNumber(n, opts = {}) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2, ...opts }).format(Number(n) || 0);
}

export function formatDate(d, opts = {}) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: opts.timeZone || "Africa/Lagos", ...opts });
}

export function formatDateTime(d, opts = {}) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: opts.timeZone || "Africa/Lagos",
    ...opts,
  });
}

export function timeAgo(d) {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

export function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";
}

export function titleCase(s = "") {
  return String(s)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function pluralize(n, word, plural) {
  return `${formatNumber(n)} ${Number(n) === 1 ? word : plural || `${word}s`}`;
}
