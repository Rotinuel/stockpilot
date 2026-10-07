// Subscription pricing (pure: safe for server and browser).
//
// Every paid plan can be bought:
//   • in NGN (businesses in Nigeria) or USD (everyone else) — both through Paystack;
//   • monthly or yearly (yearly defaults to 10 × monthly = 2 months free).
// The plan's `price` is the NGN monthly price; `yearlyPrice`, `usdPrice` and
// `usdYearlyPrice` are optional overrides set by the Super Admin.

export const BILLING_CURRENCIES = ["NGN", "USD"];
export const BILLING_CYCLES = ["monthly", "annually"];
export const YEARLY_MONTHS_CHARGED = 10; // pay for 10 months, get 12

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
  return cycle === "annually" || cycle === "yearly" ? "annually" : "monthly";
}

/** Monthly price in a currency (0 when the plan isn't sold in it). */
export function monthlyPrice(plan, currency = "NGN") {
  if (!plan) return 0;
  return currency === "USD" ? round2(plan.usdPrice || 0) : round2(plan.price || 0);
}

/** Price for one billing period. */
export function planPrice(plan, currency = "NGN", cycle = "monthly") {
  if (!plan) return 0;
  const monthly = monthlyPrice(plan, currency);
  if (normalizeCycle(cycle) === "monthly") return monthly;
  const override = currency === "USD" ? plan.usdYearlyPrice : plan.yearlyPrice;
  return override > 0 ? round2(override) : round2(monthly * YEARLY_MONTHS_CHARGED);
}

/** How much a year costs less than 12 monthly payments. */
export function yearlySaving(plan, currency = "NGN") {
  const monthly = monthlyPrice(plan, currency);
  return Math.max(0, round2(monthly * 12 - planPrice(plan, currency, "annually")));
}

export function isSoldIn(plan, currency = "NGN", cycle = "monthly") {
  return !plan?.isTrial && planPrice(plan, currency, cycle) > 0;
}

export const CYCLE_LABEL = { monthly: "month", annually: "year" };
export const CYCLE_ADJECTIVE = { monthly: "Monthly", annually: "Yearly" };

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
