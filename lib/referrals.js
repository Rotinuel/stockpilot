// Referral programme helpers shared by server and browser code (no DB, no Node APIs).

export const REFERRAL_COOKIE = "sp_ref";
export const REFERRAL_COOKIE_DAYS = 30;
// No 0/O/1/I/L so codes are easy to read out over the phone.
export const REFERRAL_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const REWARD_TYPES = ["days", "commission", "both"];
export const REFERRAL_DEFAULTS = { enabled: true, rewardType: "both", rewardDays: 30, commissionPercent: 10 };

/** Upper-cases and validates a referral code; returns null when it can't be one of ours. */
export function normalizeReferralCode(value) {
  const code = String(value || "")
    .trim()
    .toUpperCase();
  return /^[A-Z0-9]{5,16}$/.test(code) ? code : null;
}

/** Up to 4 letters from the business name, e.g. "Mama Put Stores" → "MAMA". */
export function codePrefix(businessName) {
  const letters = String(businessName || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .replace(/[OIL]/g, "");
  return (letters.slice(0, 4) || "SP").padEnd(2, "X");
}

/** Build a code from a prefix and random bytes/numbers (0–255 each). */
export function buildReferralCode(prefix, randomBytes) {
  let tail = "";
  for (const b of randomBytes) tail += REFERRAL_ALPHABET[b % REFERRAL_ALPHABET.length];
  return `${prefix}${tail}`.slice(0, 12);
}

export function commissionFor(amount, percent) {
  const value = (Number(amount) || 0) * (Number(percent) || 0) / 100;
  return Math.round(value * 100) / 100;
}

export function rewardParts(settings = REFERRAL_DEFAULTS) {
  const s = { ...REFERRAL_DEFAULTS, ...(settings || {}) };
  return {
    days: s.rewardType === "days" || s.rewardType === "both" ? Math.max(0, Number(s.rewardDays) || 0) : 0,
    percent: s.rewardType === "commission" || s.rewardType === "both" ? Math.max(0, Number(s.commissionPercent) || 0) : 0,
  };
}

/** Plain-English description of the current reward, e.g. "30 free days and 10% of their first payment". */
export function describeReward(settings) {
  const { days, percent } = rewardParts(settings);
  const parts = [];
  if (days) parts.push(`${days} free day${days === 1 ? "" : "s"} on your subscription`);
  if (percent) parts.push(`${percent}% of their first payment in cash`);
  return parts.join(" and ") || "a reward";
}
