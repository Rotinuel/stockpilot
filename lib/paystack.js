// Paystack REST client (https://paystack.com/docs/api/). Server-only:
// PAYSTACK_SECRET_KEY is read from the environment and never sent to the browser.
import crypto from "node:crypto";
import { ApiError } from "./errors.js";

const BASE_URL = "https://api.paystack.co";

// Paystack's published webhook source IPs (optional allow-list).
export const PAYSTACK_WEBHOOK_IPS = ["52.31.139.75", "52.49.173.169", "52.214.14.220"];

/**
 * Describes the Paystack setup without exposing the key.
 * @returns {{configured: boolean, mode: 'test'|'live'|null, problem: string|null}}
 */
export function paystackStatus() {
  const key = (process.env.PAYSTACK_SECRET_KEY || "").trim();
  if (!key) return { configured: false, mode: null, problem: "PAYSTACK_SECRET_KEY is not set." };
  if (/^pk_/i.test(key)) return { configured: false, mode: null, problem: "PAYSTACK_SECRET_KEY contains a public key (pk_…). Use the secret key that starts with sk_test_ or sk_live_." };
  if (!/^sk_(test|live)_\w+/i.test(key)) return { configured: false, mode: null, problem: "PAYSTACK_SECRET_KEY doesn't look like a Paystack secret key (it should start with sk_test_ or sk_live_)." };
  return { configured: true, mode: /^sk_live_/i.test(key) ? "live" : "test", problem: null };
}

export function isPaystackConfigured() {
  return paystackStatus().configured;
}

async function request(method, path, body) {
  const secret = (process.env.PAYSTACK_SECRET_KEY || "").trim();
  if (!isPaystackConfigured()) throw new ApiError(503, "Online payments are not configured yet. Please contact support.", "PAYMENTS_NOT_CONFIGURED");
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (err) {
    console.error("[paystack] network error", err?.message);
    throw new ApiError(502, "We couldn't reach the payment provider. Please try again.", "PAYMENT_GATEWAY_ERROR");
  }
  let json = null;
  try {
    json = await res.json();
  } catch {}
  if (!res.ok || json?.status === false) {
    console.error("[paystack] API error", method, path, res.status, json?.message);
    throw new ApiError(res.status >= 500 ? 502 : 400, json?.message ? `Payment provider: ${json.message}` : "The payment provider rejected the request.", "PAYMENT_GATEWAY_ERROR");
  }
  return json?.data;
}

const INTERVALS = { monthly: "monthly", quarterly: "quarterly", biannually: "biannually", annually: "annually" };

export const paystack = {
  /** POST /transaction/initialize — amount in subunits (kobo). */
  initializeTransaction: ({ email, amount, reference, callbackUrl, plan, metadata, currency = "NGN", channels }) =>
    request("POST", "/transaction/initialize", {
      email,
      amount: String(amount),
      reference,
      callback_url: callbackUrl,
      plan: plan || undefined,
      currency,
      channels,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    }),

  /** GET /transaction/verify/:reference */
  verifyTransaction: (reference) => request("GET", `/transaction/verify/${encodeURIComponent(reference)}`),

  createPlan: ({ name, amount, interval, currency = "NGN", description }) =>
    request("POST", "/plan", { name, amount, interval: INTERVALS[interval] || "monthly", currency, description }),

  updatePlan: (code, { name, amount, interval, currency = "NGN", description, updateExisting = false }) =>
    request("PUT", `/plan/${encodeURIComponent(code)}`, {
      name,
      amount,
      interval: INTERVALS[interval] || "monthly",
      currency,
      description,
      update_existing_subscriptions: updateExisting,
    }),

  createCustomer: ({ email, firstName, lastName, phone, metadata }) =>
    request("POST", "/customer", { email, first_name: firstName, last_name: lastName, phone, metadata }),

  /** Create a subscription on an existing authorization (used for scheduled downgrades). */
  createSubscription: ({ customer, plan, authorization, startDate }) =>
    request("POST", "/subscription", { customer, plan, authorization, start_date: startDate ? new Date(startDate).toISOString() : undefined }),

  fetchSubscription: (idOrCode) => request("GET", `/subscription/${encodeURIComponent(idOrCode)}`),

  disableSubscription: ({ code, token }) => request("POST", "/subscription/disable", { code, token }),

  enableSubscription: ({ code, token }) => request("POST", "/subscription/enable", { code, token }),

  /** Hosted page where the customer can update their card. */
  manageLink: (code) => request("GET", `/subscription/${encodeURIComponent(code)}/manage/link`),
};

/**
 * Verify the `x-paystack-signature` header: HMAC-SHA512 of the raw body
 * using the secret key. Uses a constant-time comparison.
 */
export function verifyPaystackSignature(rawBody, signature, secret = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY) {
  if (!secret || !signature || typeof rawBody !== "string") return false;
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(signature), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Stable idempotency key for a webhook delivery. */
export function webhookEventKey(event) {
  const d = event?.data || {};
  const id = d.id || d.reference || d.subscription_code || d.invoice_code || "";
  const status = d.status || "";
  return crypto.createHash("sha256").update(`${event?.event}:${id}:${status}:${d.paid_at || d.next_payment_date || ""}`).digest("hex");
}
