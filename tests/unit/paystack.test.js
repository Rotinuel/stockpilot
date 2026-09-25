import { describe, expect, test } from "bun:test";
import crypto from "node:crypto";
import { verifyPaystackSignature, webhookEventKey } from "../../lib/paystack.js";

const secret = "sk_test_signature_secret";
const body = JSON.stringify({ event: "charge.success", data: { id: 123, reference: "SP_ABC", status: "success", paid_at: "2026-09-25T10:00:00Z" } });
const sign = (b, s = secret) => crypto.createHmac("sha512", s).update(b).digest("hex");

describe("Paystack webhook security", () => {
  test("accepts a valid HMAC-SHA512 signature of the raw body", () => {
    expect(verifyPaystackSignature(body, sign(body), secret)).toBe(true);
  });
  test("rejects tampered bodies, wrong secrets and missing signatures", () => {
    expect(verifyPaystackSignature(body.replace("success", "failed"), sign(body), secret)).toBe(false);
    expect(verifyPaystackSignature(body, sign(body, "other"), secret)).toBe(false);
    expect(verifyPaystackSignature(body, undefined, secret)).toBe(false);
    expect(verifyPaystackSignature(body, "abc", secret)).toBe(false);
  });
  test("event keys are stable for duplicates and differ across events", () => {
    const e = JSON.parse(body);
    expect(webhookEventKey(e)).toBe(webhookEventKey(JSON.parse(body)));
    expect(webhookEventKey(e)).not.toBe(webhookEventKey({ ...e, event: "subscription.create" }));
  });
});
