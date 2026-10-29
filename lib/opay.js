// OPay Checkout client (https://doc.opaycheckout.com/). Server-only: the secret key is read
// from the environment and never sent to the browser.
//
// OPay is used for ONE-OFF payments (card, bank transfer, USSD, OPay wallet…). It has no
// subscription/plan API, so businesses that pay with OPay renew manually (we remind them).
//
// Security model (same as Paystack): the browser redirect and OPay's callback are only
// *triggers*. A payment is applied only after we ask OPay's status API ourselves
// (signed with the secret key) and the amount and currency match what we charged.
import crypto from "node:crypto";
import { ApiError } from "./errors.js";

const HOSTS = { test: "https://sandboxapi.opaycheckout.com", live: "https://api.opaycheckout.com" };
const SUCCESS_CODES = new Set(["00000", "00"]);

const env = (k, source = process.env) => String(source[k] || "").trim();

/** Currencies OPay is enabled for on this account (NGN unless OPAY_CURRENCIES says otherwise). */
export function opayCurrencies(source = process.env) {
  const list = env("OPAY_CURRENCIES", source)
    .split(/[\s,]+/)
    .map((c) => c.toUpperCase())
    .filter((c) => ["NGN", "USD"].includes(c));
  return list.length ? [...new Set(list)] : ["NGN"];
}

/**
 * Describes the OPay setup without exposing keys.
 * @returns {{ configured: boolean, mode: 'test'|'live', currencies: string[], problem: string|null }}
 */
export function opayStatus(source = process.env) {
  const mode = /^live$/i.test(env("OPAY_MODE", source)) ? "live" : "test";
  const base = { configured: false, mode, currencies: opayCurrencies(source), problem: null };
  const missing = ["OPAY_MERCHANT_ID", "OPAY_PUBLIC_KEY", "OPAY_SECRET_KEY"].filter((k) => !env(k, source));
  if (missing.length === 3) return { ...base, problem: "OPay is not set up (OPAY_MERCHANT_ID, OPAY_PUBLIC_KEY, OPAY_SECRET_KEY)." };
  if (missing.length) return { ...base, problem: `OPay setup is incomplete: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} missing.` };
  if (env("OPAY_PUBLIC_KEY", source) === env("OPAY_SECRET_KEY", source)) return { ...base, problem: "OPAY_PUBLIC_KEY and OPAY_SECRET_KEY are the same — copy both keys from the OPay merchant dashboard." };
  return { ...base, configured: true };
}

export function isOpayConfigured() {
  return opayStatus().configured;
}

/** HMAC-SHA512 (hex) of the exact JSON string sent — OPay's signature for server-to-server calls. */
export function signBody(body, secret) {
  return crypto.createHmac("sha512", secret).update(body).digest("hex");
}

async function call(path, payload, { auth }) {
  if (!isOpayConfigured()) throw new ApiError(503, "OPay payments are not configured yet. Please contact support.", "PAYMENTS_NOT_CONFIGURED");
  const { mode } = opayStatus();
  const body = JSON.stringify(payload);
  const authorization = auth === "public" ? env("OPAY_PUBLIC_KEY") : signBody(body, env("OPAY_SECRET_KEY"));
  let res;
  try {
    res = await fetch(`${HOSTS[mode]}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authorization}`, MerchantId: env("OPAY_MERCHANT_ID"), "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });
  } catch (err) {
    console.error("[opay] network error", err?.message);
    throw new ApiError(502, "We couldn't reach OPay. Please try again.", "PAYMENT_GATEWAY_ERROR");
  }
  let json = null;
  try {
    json = await res.json();
  } catch {}
  if (!res.ok || !SUCCESS_CODES.has(String(json?.code))) {
    console.error("[opay] API error", path, res.status, json?.code, json?.message);
    throw new ApiError(res.status >= 500 ? 502 : 400, json?.message ? `OPay: ${json.message}` : "OPay rejected the request.", "PAYMENT_GATEWAY_ERROR");
  }
  return json.data || {};
}

/** Countries OPay checkout uses per currency. */
const COUNTRY = { NGN: "NG", USD: "NG" };

export const opay = {
  /**
   * Creates a hosted checkout ("cashier") session. `amount` is in kobo/cents.
   * @returns {Promise<{ cashierUrl: string, orderNo: string, reference: string, status: string }>}
   */
  createCashier: ({ reference, amount, currency = "NGN", returnUrl, callbackUrl, cancelUrl, customer = {}, product = {}, clientIp }) =>
    call(
      "/api/v1/international/cashier/create",
      {
        country: COUNTRY[currency] || "NG",
        reference,
        amount: { total: Math.round(amount), currency },
        returnUrl,
        callbackUrl,
        cancelUrl,
        expireAt: 30,
        userClientIP: clientIp || undefined,
        userInfo: { userId: customer.id, userName: customer.name, userEmail: customer.email, userMobile: customer.phone },
        productList: [{ productId: product.id || "subscription", name: product.name || "StockPilot subscription", description: product.description || product.name || "StockPilot subscription", price: Math.round(amount), quantity: 1 }],
      },
      { auth: "public" },
    ),

  /** Looks up a payment by our reference (signed with the secret key). */
  queryStatus: ({ reference, currency = "NGN" }) => call("/api/v1/international/cashier/status", { country: COUNTRY[currency] || "NG", reference }, { auth: "signed" }),
};

/**
 * Turns OPay's status response into the shape the billing service uses for Paystack
 * transactions, so both providers share one verification path.
 */
export function normalizeOpayStatus(data = {}) {
  const map = { SUCCESS: "success", FAIL: "failed", CLOSE: "abandoned" };
  const status = map[String(data.status || "").toUpperCase()] || "pending";
  return {
    status,
    amount: Number(data.amount?.total ?? 0), // kobo / cents
    currency: data.amount?.currency,
    channel: data.instrumentType || data.payMethod || "opay",
    gateway_response: data.failureReason || (status === "success" ? "Successful" : String(data.status || "")),
    id: data.orderNo,
    paid_at: status === "success" ? new Date().toISOString() : null,
  };
}

/**
 * Checks an OPay callback signature (HMAC-SHA3-512 of OPay's documented field string).
 * Informational only — payments are always confirmed with queryStatus().
 */
export function verifyOpayCallback(body, secret = env("OPAY_SECRET_KEY")) {
  const p = body?.payload;
  const signature = String(body?.sha512 || "");
  if (!p || !signature || !secret) return false;
  const str = `{Amount:"${p.amount ?? ""}",Currency:"${p.currency ?? ""}",Reference:"${p.reference ?? ""}",Refunded:${p.refunded === true || p.refunded === "true" ? "t" : "f"},Status:"${p.status ?? ""}",Timestamp:"${p.timestamp ?? ""}",Token:"${p.token ?? ""}",TransactionID:"${p.transactionId ?? ""}"}`;
  for (const algo of ["sha3-512", "sha512"]) {
    try {
      const expected = crypto.createHmac(algo, secret).update(str).digest("hex");
      const a = Buffer.from(expected.toLowerCase());
      const b = Buffer.from(signature.toLowerCase());
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
    } catch {
      // algorithm not available
    }
  }
  return false;
}
