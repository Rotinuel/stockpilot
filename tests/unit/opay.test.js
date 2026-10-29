import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import crypto from "node:crypto";
import { opayStatus, opayCurrencies, signBody, normalizeOpayStatus, verifyOpayCallback, opay } from "../../lib/opay.js";

const KEYS = { OPAY_MERCHANT_ID: "256612345678901", OPAY_PUBLIC_KEY: "OPAYPUB_test_public", OPAY_SECRET_KEY: "OPAYPRV_test_secret" };

describe("configuration", () => {
  test("status explains what is missing without exposing keys", () => {
    expect(opayStatus({}).configured).toBe(false);
    expect(opayStatus({ OPAY_MERCHANT_ID: "1" }).problem).toMatch(/OPAY_PUBLIC_KEY, OPAY_SECRET_KEY are missing/);
    const ok = opayStatus(KEYS);
    expect(ok).toMatchObject({ configured: true, mode: "test", currencies: ["NGN"], problem: null });
    expect(JSON.stringify(ok)).not.toContain("OPAYPRV");
    expect(opayStatus({ ...KEYS, OPAY_MODE: "LIVE" }).mode).toBe("live");
    expect(opayStatus({ ...KEYS, OPAY_SECRET_KEY: KEYS.OPAY_PUBLIC_KEY }).configured).toBe(false);
  });

  test("currencies default to NGN and ignore unsupported codes", () => {
    expect(opayCurrencies({})).toEqual(["NGN"]);
    expect(opayCurrencies({ OPAY_CURRENCIES: "ngn, usd, eur" })).toEqual(["NGN", "USD"]);
  });
});

describe("responses and signatures", () => {
  test("normalizes OPay statuses to the billing shape", () => {
    expect(normalizeOpayStatus({ status: "SUCCESS", orderNo: "1", amount: { total: 500000, currency: "NGN" }, instrumentType: "BankCard" })).toMatchObject({ status: "success", amount: 500000, currency: "NGN", id: "1", channel: "BankCard" });
    expect(normalizeOpayStatus({ status: "FAIL", failureReason: "Declined" })).toMatchObject({ status: "failed", gateway_response: "Declined" });
    expect(normalizeOpayStatus({ status: "CLOSE" }).status).toBe("abandoned");
    expect(normalizeOpayStatus({ status: "INITIAL" }).status).toBe("pending");
    expect(normalizeOpayStatus({ status: "PENDING" }).status).toBe("pending");
  });

  test("signs the exact body with HMAC-SHA512", () => {
    const body = JSON.stringify({ country: "NG", reference: "SP123" });
    expect(signBody(body, "k")).toBe(crypto.createHmac("sha512", "k").update(body).digest("hex"));
  });

  test("verifies callback signatures and rejects tampered ones", () => {
    const payload = { amount: "500000", currency: "NGN", reference: "SP_abc123", refunded: false, status: "SUCCESS", timestamp: "2026-10-09T10:00:00Z", token: "2610", transactionId: "2610" };
    const str = `{Amount:"500000",Currency:"NGN",Reference:"SP_abc123",Refunded:f,Status:"SUCCESS",Timestamp:"2026-10-09T10:00:00Z",Token:"2610",TransactionID:"2610"}`;
    const sha512 = crypto.createHmac("sha3-512", "secret").update(str).digest("hex");
    expect(verifyOpayCallback({ payload, sha512, type: "transaction-status" }, "secret")).toBe(true);
    expect(verifyOpayCallback({ payload: { ...payload, amount: "1" }, sha512 }, "secret")).toBe(false);
    expect(verifyOpayCallback({ payload, sha512 }, "other-secret")).toBe(false);
    expect(verifyOpayCallback({ payload }, "secret")).toBe(false);
  });
});

describe("API calls", () => {
  const saved = {};
  let calls;
  let reply;
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    for (const k of [...Object.keys(KEYS), "OPAY_MODE"]) saved[k] = process.env[k];
    Object.assign(process.env, KEYS);
    delete process.env.OPAY_MODE;
    calls = [];
    reply = { code: "00000", message: "SUCCESSFUL", data: { cashierUrl: "https://sandboxcashier.opaycheckout.com/x", orderNo: "2610", reference: "SP_abc123", status: "INITIAL" } };
    globalThis.fetch = async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(reply), { status: 200, headers: { "Content-Type": "application/json" } });
    };
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    for (const [k, v] of Object.entries(saved)) (v === undefined ? delete process.env[k] : (process.env[k] = v));
  });

  test("creates a cashier session with the public key and amount in kobo", async () => {
    const res = await opay.createCashier({ reference: "SP_abc123", amount: 500000, currency: "NGN", returnUrl: "https://app/x", callbackUrl: "https://app/api/opay/webhook", customer: { email: "o@x.co" }, product: { name: "Pro" } });
    expect(res.cashierUrl).toContain("opaycheckout.com");
    const { url, init } = calls[0];
    expect(url).toBe("https://sandboxapi.opaycheckout.com/api/v1/international/cashier/create");
    expect(init.headers.Authorization).toBe("Bearer OPAYPUB_test_public");
    expect(init.headers.MerchantId).toBe(KEYS.OPAY_MERCHANT_ID);
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ country: "NG", reference: "SP_abc123", amount: { total: 500000, currency: "NGN" }, callbackUrl: "https://app/api/opay/webhook" });
  });

  test("status query is signed with the secret key; live mode uses the live host", async () => {
    process.env.OPAY_MODE = "live";
    reply = { code: "00000", data: { status: "SUCCESS", amount: { total: 500000, currency: "NGN" } } };
    await opay.queryStatus({ reference: "SP_abc123" });
    const { url, init } = calls[0];
    expect(url).toBe("https://api.opaycheckout.com/api/v1/international/cashier/status");
    expect(init.headers.Authorization).toBe(`Bearer ${signBody(init.body, KEYS.OPAY_SECRET_KEY)}`);
    expect(JSON.parse(init.body)).toEqual({ country: "NG", reference: "SP_abc123" });
  });

  test("OPay errors become friendly API errors", async () => {
    reply = { code: "02000", message: "authentication failed" };
    await expect(opay.queryStatus({ reference: "SP_abc123" })).rejects.toThrow(/OPay: authentication failed/);
  });

  test("refuses to call OPay when keys are missing", async () => {
    delete process.env.OPAY_SECRET_KEY;
    await expect(opay.queryStatus({ reference: "SP_abc123" })).rejects.toThrow(/not configured/);
    expect(calls).toHaveLength(0);
  });
});
