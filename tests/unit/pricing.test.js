import { describe, expect, test } from "bun:test";
import { planPrice, yearlySaving, billingCurrencyFor, tenantBillingCurrency, isSoldIn, storedPaystackPlanCode, matchPaystackPlanCode, normalizeCycle, lifetimeUpgradePrice, isLifetime, LIFETIME_END } from "../../lib/pricing.js";
import { normalizePhone } from "../../lib/phone.js";
import { COUNTRIES, CURRENCIES, TRIAL_DAYS } from "../../lib/constants.js";

const starter = { _id: "s", name: "Starter", price: 5000, usdPrice: 9, paystackPlanCode: "PLN_ngn_m", paystackPlanCodes: { NGN_annually: "PLN_ngn_y", USD_monthly: "PLN_usd_m" } };
const custom = { _id: "c", name: "Custom", price: 10000, yearlyPrice: 96000, usdPrice: 0 };

describe("subscription pricing", () => {
  test("yearly defaults to 10 × monthly (2 months free)", () => {
    expect(planPrice(starter, "NGN", "monthly")).toBe(5000);
    expect(planPrice(starter, "NGN", "annually")).toBe(50000);
    expect(planPrice(starter, "USD", "annually")).toBe(90);
    expect(yearlySaving(starter, "NGN")).toBe(10000);
  });
  test("yearly override and plans not sold in USD", () => {
    expect(planPrice(custom, "NGN", "annually")).toBe(96000);
    expect(isSoldIn(custom, "USD", "monthly")).toBe(false);
    expect(isSoldIn({ ...custom, isTrial: true }, "NGN", "monthly")).toBe(false);
  });
  test("billing currency by country", () => {
    expect(billingCurrencyFor("NG")).toBe("NGN");
    expect(billingCurrencyFor("GB")).toBe("USD");
    expect(tenantBillingCurrency({ country: "KE" })).toBe("USD");
    expect(tenantBillingCurrency({ country: "KE", billingCurrency: "NGN" })).toBe("NGN");
    expect(normalizeCycle("yearly")).toBe("annually");
  });
  test("Paystack plan codes per currency and cycle", () => {
    expect(storedPaystackPlanCode(starter, "NGN", "monthly")).toBe("PLN_ngn_m");
    expect(storedPaystackPlanCode(starter, "USD", "annually")).toBe("");
    expect(matchPaystackPlanCode([custom, starter], "PLN_ngn_y")).toEqual({ plan: starter, currency: "NGN", cycle: "annually" });
    expect(matchPaystackPlanCode([starter], "PLN_ngn_m")?.cycle).toBe("monthly");
    expect(matchPaystackPlanCode([starter], "nope")).toBe(null);
  });
});

describe("global sign-up", () => {
  test("trial is 3 days", () => expect(TRIAL_DAYS).toBe(3));
  test("every country currency is selectable", () => {
    const codes = new Set(CURRENCIES.map((c) => c.code));
    for (const c of COUNTRIES) expect(codes.has(c.currency)).toBe(true);
  });
  test("phone numbers in other countries", () => {
    expect(normalizePhone("07700 900123", "GB")).toBe("+447700900123");
    expect(normalizePhone("0712 345678", "KE")).toBe("+254712345678");
    expect(normalizePhone("(415) 555-0132", "US")).toBe("+14155550132");
    expect(normalizePhone("+33 6 12 34 56 78", "OTHER")).toBe("+33612345678");
    expect(normalizePhone("612345678", "OTHER")).toBe(null);
    expect(normalizePhone("0803 123 4567", "NG")).toBe("+2348031234567");
  });
});

describe("lifetime access", () => {
  const pro = { _id: "p", name: "Pro", price: 10000, usdPrice: 19 };
  test("defaults to 60 × monthly, with per-currency overrides", () => {
    expect(planPrice(starter, "NGN", "lifetime")).toBe(300000);
    expect(planPrice(starter, "USD", "lifetime")).toBe(540);
    expect(planPrice({ ...starter, lifetimePrice: 250000, usdLifetimePrice: 499 }, "NGN", "lifetime")).toBe(250000);
    expect(planPrice({ ...starter, lifetimePrice: 250000, usdLifetimePrice: 499 }, "USD", "lifetime")).toBe(499);
    expect(normalizeCycle("lifetime")).toBe("lifetime");
  });
  test("can be switched off per plan and is never sold for trials or missing currencies", () => {
    expect(isSoldIn(starter, "NGN", "lifetime")).toBe(true);
    expect(isSoldIn({ ...starter, lifetimeEnabled: false }, "NGN", "lifetime")).toBe(false);
    expect(isSoldIn({ ...starter, lifetimeEnabled: false }, "NGN", "monthly")).toBe(true);
    expect(isSoldIn({ ...starter, isTrial: true }, "NGN", "lifetime")).toBe(false);
    expect(isSoldIn(custom, "USD", "lifetime")).toBe(false);
    expect(planPrice({ ...custom, usdLifetimePrice: 999 }, "USD", "lifetime")).toBe(0);
  });
  test("upgrades only cost the difference", () => {
    expect(lifetimeUpgradePrice(starter, pro, "NGN")).toBe(300000);
    expect(lifetimeUpgradePrice(pro, starter, "NGN")).toBe(0);
    expect(lifetimeUpgradePrice(starter, pro, "USD")).toBe(600);
  });
  test("lifetime accounts", () => {
    expect(isLifetime({ billingCycle: "lifetime" })).toBe(true);
    expect(isLifetime({ billingCycle: "annually" })).toBe(false);
    expect(LIFETIME_END.getUTCFullYear()).toBe(2999);
  });
});
