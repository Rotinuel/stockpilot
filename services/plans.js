import { connectDB } from "../lib/db.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import { TRIAL_DAYS } from "../lib/constants.js";

// Plans are read on almost every request → short in-process cache.
const TTL_MS = 60_000;
let cache = { at: 0, plans: null };

export function invalidatePlanCache() {
  cache = { at: 0, plans: null };
}

// Safety net used only if the database has no plans yet (before seeding).
export const FALLBACK_TRIAL_PLAN = {
  _id: null,
  code: "trial",
  name: "Free Trial",
  price: 0,
  currency: "NGN",
  isTrial: true,
  durationDays: TRIAL_DAYS,
  limits: { products: 100, staffUsers: 2, locations: 1, monthlyTransactions: -1 },
  features: {},
  featureList: [],
};

export async function getAllPlans({ includeInactive = false } = {}) {
  await connectDB();
  if (!cache.plans || Date.now() - cache.at > TTL_MS) {
    const plans = await SubscriptionPlan.find({}).sort({ sortOrder: 1, price: 1 }).lean();
    // The trial length is a business rule (TRIAL_DAYS), whatever an older seed stored.
    cache = { at: Date.now(), plans: plans.map((p) => (p.isTrial ? { ...p, durationDays: TRIAL_DAYS } : p)) };
  }
  return includeInactive ? cache.plans : cache.plans.filter((p) => p.isActive);
}

export async function getPublicPlans() {
  try {
    const plans = await getAllPlans();
    return plans.filter((p) => p.isPublic);
  } catch (err) {
    console.error("[plans] failed to load plans", err?.message);
    return [];
  }
}

export async function getPaidPlans() {
  return (await getAllPlans()).filter((p) => !p.isTrial && p.isPublic);
}

export async function getPlanById(id) {
  if (!id) return null;
  const plans = await getAllPlans({ includeInactive: true });
  return plans.find((p) => String(p._id) === String(id)) || null;
}

export async function getPlanByCode(code) {
  const plans = await getAllPlans({ includeInactive: true });
  return plans.find((p) => p.code === code) || null;
}

export async function getTrialPlan() {
  const plans = await getAllPlans({ includeInactive: true });
  return plans.find((p) => p.isTrial) || FALLBACK_TRIAL_PLAN;
}

/** The plan whose limits/features apply to the tenant right now. */
export async function getEffectivePlan(tenant) {
  if (!tenant) return FALLBACK_TRIAL_PLAN;
  const plan = (await getPlanById(tenant.subscriptionPlan)) || (await getPlanByCode(tenant.subscriptionPlanCode));
  return plan || (await getTrialPlan());
}
