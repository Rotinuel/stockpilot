// The free trial used to be 7 days; it is now TRIAL_DAYS (3). Trials that were created with the
// old 7-day length are shortened to the new length (measured from the day they started).
// Trials deliberately extended by a super admin or a referral reward are a different length and
// are left alone.
import Tenant from "../models/Tenant.js";
import Subscription from "../models/Subscription.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import { TRIAL_DAYS } from "../lib/constants.js";
import { addDays, isLegacyTrial } from "../lib/access.js";

export { isLegacyTrial };

/** Shorten one tenant's legacy 7-day trial. Returns the (possibly updated) tenant. */
export async function applyTrialLength(tenant) {
  if (!isLegacyTrial(tenant)) return tenant;
  const trialEndsAt = addDays(tenant.trialStartedAt, TRIAL_DAYS);
  await Tenant.updateOne({ _id: tenant._id, trialEndsAt: tenant.trialEndsAt }, { $set: { trialEndsAt } });
  await Subscription.updateMany({ tenantId: tenant._id, status: "trialing" }, { $set: { currentPeriodEnd: trialEndsAt } });
  return { ...tenant, trialEndsAt };
}

/** Shorten every legacy 7-day trial (used by the seed script and the daily cron). */
export async function applyTrialLengthToAll() {
  await SubscriptionPlan.updateMany({ isTrial: true, durationDays: { $ne: TRIAL_DAYS } }, { $set: { durationDays: TRIAL_DAYS, description: `Try StockPilot free for ${TRIAL_DAYS} days. No payment required.` } });
  const tenants = await Tenant.find({ subscriptionStatus: "trialing" }).select("subscriptionStatus trialStartedAt trialEndsAt").lean();
  let updated = 0;
  for (const t of tenants) {
    if (isLegacyTrial(t)) {
      await applyTrialLength(t);
      updated++;
    }
  }
  return { checked: tenants.length, updated };
}
