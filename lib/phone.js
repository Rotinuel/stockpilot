// Phone number helpers (pure). Numbers are stored in E.164 (+2348031234567)
// so they can be used for WhatsApp and click-to-chat links.

import { COUNTRIES } from "./constants.js";

export const DIAL_CODES = Object.fromEntries(COUNTRIES.filter((c) => c.dial).map((c) => [c.code, c.dial]));

/**
 * Normalise a local or international number to E.164.
 * "0803 123 4567" (NG) → "+2348031234567"; "+44 7700 900123" → "+447700900123".
 * @returns {string|null} null when it can't be a valid number
 */
export function normalizePhone(input, countryCode = "NG") {
  if (input === undefined || input === null) return null;
  let s = String(input).trim();
  if (!s) return null;
  const hasPlus = s.startsWith("+");
  let digits = s.replace(/\D/g, "");
  if (!digits) return null;
  const dial = DIAL_CODES[countryCode] || (countryCode === "OTHER" ? "" : DIAL_CODES.NG);
  if (hasPlus) {
    // already international
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (!dial) {
    return null; // unknown country: the number must include its country code (+…)
  } else if (digits.startsWith("0")) {
    digits = dial + digits.slice(1);
  } else if (!digits.startsWith(dial)) {
    digits = dial + digits;
  }
  if (digits.length < 8 || digits.length > 15) return null;
  // Nigerian mobile numbers: +234 followed by 10 digits
  if (digits.startsWith("234") && digits.length !== 13) return null;
  return `+${digits}`;
}

/** Digits only (what WhatsApp Cloud API and wa.me links expect). */
export function waDigits(e164) {
  return String(e164 || "").replace(/\D/g, "");
}

/** Click-to-chat link that opens WhatsApp with a prefilled message. */
export function whatsappLink(phone, text, countryCode = "NG") {
  const e164 = normalizePhone(phone, countryCode);
  const base = e164 ? `https://wa.me/${waDigits(e164)}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text || "")}`;
}
