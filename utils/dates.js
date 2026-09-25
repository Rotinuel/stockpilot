// Timezone-aware date ranges for reports (no external libraries).
// Ranges are half-open: [from, to).

export const DEFAULT_TZ = "Africa/Lagos";

export const RANGE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This week" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_year", label: "This year" },
  { value: "custom", label: "Custom range" },
];

function partsInTz(date, tz) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const p = {};
  for (const { type, value } of fmt.formatToParts(date)) p[type] = value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** Offset (ms) of `tz` from UTC at instant `date`. */
export function tzOffsetMs(date, tz = DEFAULT_TZ) {
  const p = partsInTz(date, tz);
  const asUTC = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return asUTC - Math.floor(date.getTime() / 1000) * 1000;
}

/** UTC instant of local midnight for calendar day y-m-d in tz. */
export function zonedMidnight(y, m, d, tz = DEFAULT_TZ) {
  const guess = new Date(Date.UTC(y, m - 1, d));
  const offset = tzOffsetMs(guess, tz);
  const result = new Date(guess.getTime() - offset);
  const offset2 = tzOffsetMs(result, tz);
  return offset2 === offset ? result : new Date(guess.getTime() - offset2);
}

export function localDateParts(date = new Date(), tz = DEFAULT_TZ) {
  const p = partsInTz(date, tz);
  return { y: p.y, m: p.m, d: p.d };
}

export function startOfDay(date = new Date(), tz = DEFAULT_TZ) {
  const { y, m, d } = localDateParts(date, tz);
  return zonedMidnight(y, m, d, tz);
}

function shiftDays({ y, m, d }, days) {
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function parseYmd(s) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  if (!match) return null;
  return { y: +match[1], m: +match[2], d: +match[3] };
}

export function toYmd(date = new Date(), tz = DEFAULT_TZ) {
  const { y, m, d } = localDateParts(date, tz);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Resolve a preset (or custom from/to YYYY-MM-DD, inclusive) into a UTC range.
 * @returns {{from: Date, to: Date, label: string, preset: string, days: number}}
 */
export function resolveRange(preset = "this_month", { from, to, tz = DEFAULT_TZ, now = new Date() } = {}) {
  const today = localDateParts(now, tz);
  const mk = (a, b, label) => {
    const f = zonedMidnight(a.y, a.m, a.d, tz);
    const t = zonedMidnight(b.y, b.m, b.d, tz);
    return { from: f, to: t, label, preset, days: Math.max(1, Math.round((t - f) / 86400000)) };
  };
  switch (preset) {
    case "today":
      return mk(today, shiftDays(today, 1), "Today");
    case "yesterday":
      return mk(shiftDays(today, -1), today, "Yesterday");
    case "this_week": {
      const dow = new Date(Date.UTC(today.y, today.m - 1, today.d)).getUTCDay(); // 0=Sun
      const mondayOffset = dow === 0 ? -6 : 1 - dow;
      return mk(shiftDays(today, mondayOffset), shiftDays(today, 1), "This week");
    }
    case "last_7_days":
      return mk(shiftDays(today, -6), shiftDays(today, 1), "Last 7 days");
    case "last_30_days":
      return mk(shiftDays(today, -29), shiftDays(today, 1), "Last 30 days");
    case "last_month": {
      const firstThis = { y: today.y, m: today.m, d: 1 };
      const lm = today.m === 1 ? { y: today.y - 1, m: 12, d: 1 } : { y: today.y, m: today.m - 1, d: 1 };
      return mk(lm, firstThis, "Last month");
    }
    case "this_year":
      return mk({ y: today.y, m: 1, d: 1 }, shiftDays(today, 1), "This year");
    case "custom": {
      const a = parseYmd(from);
      const b = parseYmd(to);
      if (a && b) {
        const [s, e] = Date.UTC(a.y, a.m - 1, a.d) <= Date.UTC(b.y, b.m - 1, b.d) ? [a, b] : [b, a];
        return { ...mk(s, shiftDays(e, 1), `${from} → ${to}`), preset: "custom" };
      }
      return resolveRange("this_month", { tz, now });
    }
    case "this_month":
    default:
      return { ...mk({ y: today.y, m: today.m, d: 1 }, shiftDays(today, 1), "This month"), preset: "this_month" };
  }
}

/** List of YYYY-MM-DD keys between from (inclusive) and to (exclusive). */
export function dayKeys(from, to, tz = DEFAULT_TZ) {
  const keys = [];
  let cur = localDateParts(from, tz);
  const end = toYmd(new Date(to.getTime() - 1), tz);
  for (let i = 0; i < 400; i++) {
    const key = `${cur.y}-${String(cur.m).padStart(2, "0")}-${String(cur.d).padStart(2, "0")}`;
    keys.push(key);
    if (key === end) break;
    cur = shiftDays(cur, 1);
  }
  return keys;
}
