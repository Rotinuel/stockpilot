// Subscription pricing (pure: safe for server and browser).
//
// Every paid plan can be bought:
//   • in NGN (businesses in Nigeria) or USD (everyone else) — both through Paystack;
//   • monthly or yearly (yearly defaults to 10 × monthly = 2 months free);
//   • or once, for LIFETIME access to that plan (defaults to 60 × monthly = 5 years).
// The plan's `price` is the NGN monthly price; `yearlyPrice`, `usdPrice`, `usdYearlyPrice`,
// `lifetimePrice` and `usdLifetimePrice` are optional overrides set by the Super Admin.
// `lifetimeEnabled: false` stops a plan being sold for life.

export const BILLING_CURRENCIES = ["NGN", "USD"];
export const BILLING_CYCLES = ["monthly", "annually", "lifetime"];
export const YEARLY_MONTHS_CHARGED = 10; // pay for 10 months, get 12
export const LIFETIME_MONTHS_CHARGED = 60; // lifetime = 5 years of monthly payments
// Lifetime access is stored as a period that never realistically ends, so every access check,
// reminder and expiry job keeps working without special cases.
export const LIFETIME_END = new Date("2999-12-31T00:00:00.000Z");

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Nigerian businesses pay in Naira; everyone else in US dollars. */
export function billingCurrencyFor(countryCode) {
  return !countryCode || countryCode === "NG" ? "NGN" : "USD";
}

/** The currency a tenant is billed in (stored at sign-up; derived from country for older accounts). */
export function tenantBillingCurrency(tenant) {
  return BILLING_CURRENCIES.includes(tenant?.billingCurrency) ? tenant.billingCurrency : billingCurrencyFor(tenant?.country);
}

export function normalizeCycle(cycle) {
  if (cycle === "lifetime") return "lifetime";
  return cycle === "annually" || cycle === "yearly" ? "annually" : "monthly";
}

/** True when the business bought lifetime access. */
export function isLifetime(tenant) {
  return tenant?.billingCycle === "lifetime";
}

/** Monthly price in a currency (0 when the plan isn't sold in it). */
export function monthlyPrice(plan, currency = "NGN") {
  if (!plan) return 0;
  return currency === "USD" ? round2(plan.usdPrice || 0) : round2(plan.price || 0);
}

/** Price for one billing period (or the one-time lifetime price). */
export function planPrice(plan, currency = "NGN", cycle = "monthly") {
  if (!plan) return 0;
  const monthly = monthlyPrice(plan, currency);
  const c = normalizeCycle(cycle);
  if (c === "monthly") return monthly;
  if (c === "lifetime") {
    if (monthly <= 0) return 0; // not sold in this currency at all
    const override = currency === "USD" ? plan.usdLifetimePrice : plan.lifetimePrice;
    return override > 0 ? round2(override) : round2(monthly * LIFETIME_MONTHS_CHARGED);
  }
  const override = currency === "USD" ? plan.usdYearlyPrice : plan.yearlyPrice;
  return override > 0 ? round2(override) : round2(monthly * YEARLY_MONTHS_CHARGED);
}

/** How much a year costs less than 12 monthly payments. */
export function yearlySaving(plan, currency = "NGN") {
  const monthly = monthlyPrice(plan, currency);
  return Math.max(0, round2(monthly * 12 - planPrice(plan, currency, "annually")));
}

export function isSoldIn(plan, currency = "NGN", cycle = "monthly") {
  if (!plan || plan.isTrial) return false;
  if (normalizeCycle(cycle) === "lifetime" && plan.lifetimeEnabled === false) return false;
  return planPrice(plan, currency, cycle) > 0;
}

/**
 * What a business already on lifetime `current` pays to move to lifetime `target`:
 * the difference between the two lifetime prices (0 when it isn't an upgrade).
 */
export function lifetimeUpgradePrice(current, target, currency = "NGN") {
  return Math.max(0, round2(planPrice(target, currency, "lifetime") - planPrice(current, currency, "lifetime")));
}

export const CYCLE_LABEL = { monthly: "month", annually: "year", lifetime: "lifetime" };
export const CYCLE_ADJECTIVE = { monthly: "Monthly", annually: "Yearly", lifetime: "Lifetime" };
/** "/month", "/year" or " one-time" — what goes after a price. */
export const PRICE_SUFFIX = { monthly: "/month", annually: "/year", lifetime: " one-time" };

/** Paystack plan code for a currency/cycle (stored on the plan; NGN monthly also uses the legacy field). */
export function paystackPlanKey(currency, cycle) {
  return `${currency}_${normalizeCycle(cycle)}`;
}

export function storedPaystackPlanCode(plan, currency, cycle) {
  const codes = plan?.paystackPlanCodes || {};
  const key = paystackPlanKey(currency, cycle);
  const code = typeof codes.get === "function" ? codes.get(key) : codes[key];
  if (code) return code;
  if (currency === "NGN" && normalizeCycle(cycle) === "monthly" && plan?.paystackPlanCode) return plan.paystackPlanCode;
  return "";
}

/** Which plan/currency/cycle a Paystack plan code belongs to. */
export function matchPaystackPlanCode(plans, code) {
  if (!code) return null;
  for (const plan of plans) {
    if (plan.paystackPlanCode === code) return { plan, currency: "NGN", cycle: "monthly" };
    const codes = plan.paystackPlanCodes || {};
    const entries = typeof codes.entries === "function" && !Array.isArray(codes) && codes instanceof Map ? [...codes.entries()] : Object.entries(codes);
    for (const [key, value] of entries) {
      if (value === code) {
        const [currency, cycle] = key.split("_");
        return { plan, currency, cycle: normalizeCycle(cycle) };
      }
    }
  }
  return null;
}
