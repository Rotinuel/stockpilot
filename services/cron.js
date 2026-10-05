// Automated billing & housekeeping jobs. Every job is idempotent, so running
// it more often than necessary is harmless. Triggered by:
//   • GET/POST /api/cron/<task> with "Authorization: Bearer $CRON_SECRET"
//     (Vercel Cron, GitHub Actions, cron-job.org, a system crontab + curl…)
//   • `bun run cron [task]` on a server with a traditional crontab
import Tenant from "../models/Tenant.js";
import Subscription from "../models/Subscription.js";
import Payment from "../models/Payment.js";
import Product from "../models/Product.js";
import { connectDB } from "../lib/db.js";
import { dueTrialReminder, addDays } from "../lib/access.js";
import { hasFeature } from "../lib/plans.js";
import { notify } from "./notifications.js";
import { getPlatformSettings } from "./platform.js";
import { getEffectivePlan } from "./plans.js";
import { logAudit } from "./audit.js";
import { verifyAndApply, syncSubscriptionFromPaystack, applyScheduledPlanChange } from "./billing.js";
import { isPaystackConfigured } from "../lib/paystack.js";
import { applyAllPendingCredits } from "./referrals.js";

const BATCH = 200;
const system = (tenantId) => ({ tenantId, userName: "System", role: "system" });

export async function sendTrialReminders(now = new Date()) {
  const tenants = await Tenant.find({ subscriptionStatus: "trialing", trialEndsAt: { $lte: addDays(now, 5), $gt: now } })
    .select("trialEndsAt remindersSent subscriptionStatus businessName")
    .limit(BATCH)
    .lean();
  let sent = 0;
  for (const t of tenants) {
    const key = dueTrialReminder(t, now);
    if (!key || key === "trial-expired") continue;
    const mark = Number(key.split("-")[1]);
    const days = Math.max(1, Math.ceil((new Date(t.trialEndsAt) - now) / 86400000));
    const severity = mark === 1 ? "danger" : mark === 3 ? "warning" : "info";
    await notify({
      tenantId: t._id,
      roles: ["owner", "admin"],
      type: "trial_ending",
      severity,
      title: mark === 1 ? "Your free trial ends tomorrow" : `Your free trial ends in ${days} days`,
      message: "Choose a plan to keep recording sales and managing stock without interruption. Your data stays safe either way.",
      link: "/billing",
      dedupeKey: `${key}:${t._id}`,
      email: true,
      whatsapp: true,
    });
    // Mark this and all earlier (larger) reminders as sent.
    const marks = [1, 3, 5].filter((m) => m >= mark).map((m) => `trial-${m}`);
    await Tenant.updateOne({ _id: t._id }, { $addToSet: { remindersSent: { $each: marks } } });
    sent++;
  }
  return { checked: tenants.length, sent };
}

export async function expireTrials(now = new Date()) {
  const tenants = await Tenant.find({ subscriptionStatus: "trialing", trialEndsAt: { $lte: now } }).select("_id").limit(BATCH).lean();
  for (const t of tenants) {
    const res = await Tenant.updateOne({ _id: t._id, subscriptionStatus: "trialing" }, { $set: { subscriptionStatus: "expired" }, $addToSet: { remindersSent: "trial-expired" } });
    if (!res.modifiedCount) continue;
    await Subscription.updateMany({ tenantId: t._id, status: "trialing" }, { $set: { status: "expired", endedAt: now } });
    await notify({
      tenantId: t._id,
      roles: ["owner", "admin"],
      type: "trial_expired",
      severity: "danger",
      title: "Your free trial has ended",
      message: "Your account is now read-only. Subscribe to continue recording sales, purchases and stock changes. All your data has been kept.",
      link: "/billing",
      dedupeKey: `trial-expired:${t._id}`,
      email: true,
      whatsapp: true,
    });
    await logAudit(system(t._id), "subscription.trial_expired", { entity: "Tenant", entityId: t._id });
  }
  return { expired: tenants.length };
}

export async function processSubscriptionExpiry(now = new Date()) {
  const platform = await getPlatformSettings();
  const result = { pastDue: 0, expired: 0, cancelledEnded: 0, planChanges: 0 };

  // 0) Scheduled downgrades
  const pending = await Tenant.find({ "pendingPlanChange.effectiveAt": { $lte: now } }).limit(BATCH).lean();
  for (const t of pending) if (await applyScheduledPlanChange(t)) result.planChanges++;

  // 1) Active subscriptions past their period end without a confirmed renewal → past_due (grace period)
  const overdue = await Tenant.find({ subscriptionStatus: "active", subscriptionEndDate: { $lt: now } }).limit(BATCH).lean();
  for (const t of overdue) {
    const graceEndsAt = addDays(t.subscriptionEndDate, platform.gracePeriodDays);
    await Tenant.updateOne({ _id: t._id, subscriptionStatus: "active" }, { $set: { subscriptionStatus: "past_due", pastDueSince: now, graceEndsAt } });
    await Subscription.updateMany({ tenantId: t._id, status: "active" }, { $set: { status: "past_due" } });
    await notify({
      tenantId: t._id,
      roles: ["owner", "admin"],
      type: "payment_failed",
      severity: "warning",
      title: t.billingMode === "manual" ? "Your subscription has ended — renew now" : "We couldn't confirm your renewal",
      message:
        t.billingMode === "manual"
          ? `Pay for your next period from Billing to keep everything running. You have until ${graceEndsAt.toDateString()} before your account becomes read-only.`
          : `Please check your payment method. You have until ${graceEndsAt.toDateString()} before your account becomes read-only.`,
      link: "/billing",
      dedupeKey: `overdue:${t._id}:${new Date(t.subscriptionEndDate).toISOString().slice(0, 10)}`,
      email: true,
      whatsapp: true,
    });
    result.pastDue++;
  }

  // 2) Grace period over → expired (read-only; data preserved)
  const graceOver = await Tenant.find({ subscriptionStatus: "past_due", graceEndsAt: { $lt: now } }).select("_id").limit(BATCH).lean();
  for (const t of graceOver) {
    await Tenant.updateOne({ _id: t._id, subscriptionStatus: "past_due" }, { $set: { subscriptionStatus: "expired" } });
    await Subscription.updateMany({ tenantId: t._id, status: "past_due" }, { $set: { status: "expired", endedAt: now } });
    await notify({
      tenantId: t._id,
      roles: ["owner", "admin"],
      type: "payment_failed",
      severity: "danger",
      title: "Your account is now read-only",
      message: "Your grace period has ended. Renew your subscription to continue. No data has been deleted.",
      link: "/billing",
      dedupeKey: `graceover:${t._id}:${now.toISOString().slice(0, 10)}`,
      email: true,
      whatsapp: true,
    });
    await logAudit(system(t._id), "subscription.suspended_for_nonpayment", { entity: "Tenant", entityId: t._id });
    result.expired++;
  }

  // 3) Cancelled subscriptions that reached the end of their paid period
  const ended = await Tenant.find({ subscriptionStatus: "cancelled", subscriptionEndDate: { $lt: now } }).select("_id").limit(BATCH).lean();
  for (const t of ended) {
    await Tenant.updateOne({ _id: t._id, subscriptionStatus: "cancelled" }, { $set: { subscriptionStatus: "expired" } });
    await Subscription.updateMany({ tenantId: t._id, status: "cancelled" }, { $set: { status: "expired", endedAt: now } });
    result.cancelledEnded++;
  }
  return result;
}

export async function reconcilePendingPayments(now = new Date()) {
  if (!isPaystackConfigured()) return { skipped: "paystack_not_configured" };
  const stale = await Payment.find({ status: "pending", createdAt: { $lt: new Date(now - 15 * 60 * 1000), $gt: addDays(now, -3) } })
    .limit(50)
    .lean();
  const out = { checked: stale.length, success: 0, failed: 0, abandoned: 0 };
  for (const p of stale) {
    try {
      const r = await verifyAndApply(p.reference, { via: "cron" });
      if (r.status === "success") out.success++;
      else if (r.status === "failed") out.failed++;
      else if (r.status === "abandoned") out.abandoned++;
    } catch (err) {
      console.warn("[cron] reconcile failed", p.reference, err?.message);
    }
  }
  const old = await Payment.updateMany({ status: "pending", createdAt: { $lte: addDays(now, -3) } }, { $set: { status: "abandoned", failureReason: "Checkout not completed" } });
  out.abandoned += old.modifiedCount || 0;
  return out;
}

export async function syncSubscriptions() {
  if (!isPaystackConfigured()) return { skipped: "paystack_not_configured" };
  const tenants = await Tenant.find({ paystackSubscriptionCode: { $nin: [null, ""] }, subscriptionStatus: { $in: ["active", "past_due", "cancelled"] } })
    .limit(100)
    .lean();
  let synced = 0;
  for (const t of tenants) {
    try {
      await syncSubscriptionFromPaystack(t);
      synced++;
    } catch (err) {
      console.warn("[cron] sync failed", t._id, err?.message);
    }
  }
  return { synced };
}

/** Businesses that pay each period themselves (transfer, USSD…) get reminded 5, 3 and 1 day(s) before it ends. */
export async function sendRenewalReminders(now = new Date()) {
  const tenants = await Tenant.find({
    subscriptionStatus: "active",
    billingMode: "manual",
    subscriptionEndDate: { $gt: now, $lte: addDays(now, 5) },
  })
    .select("subscriptionEndDate businessName")
    .limit(BATCH)
    .lean();
  let sent = 0;
  for (const t of tenants) {
    const days = Math.max(1, Math.ceil((new Date(t.subscriptionEndDate) - now) / 86400000));
    const mark = days <= 1 ? 1 : days <= 3 ? 3 : 5;
    const end = new Date(t.subscriptionEndDate);
    await notify({
      tenantId: t._id,
      roles: ["owner", "admin"],
      type: "renewal_due",
      severity: mark === 1 ? "danger" : "warning",
      title: mark === 1 ? "Your subscription ends tomorrow" : `Your subscription ends in ${days} days`,
      message: `Renew from Billing before ${end.toDateString()} to avoid interruption. You can pay by transfer, USSD or card.`,
      link: "/billing",
      dedupeKey: `renew-${mark}:${t._id}:${end.toISOString().slice(0, 10)}`,
      email: true,
      whatsapp: true,
    });
    sent++;
  }
  return { checked: tenants.length, sent };
}

export async function lowStockDigest(now = new Date()) {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const tenants = await Tenant.find({
    status: "active",
    subscriptionStatus: { $in: ["trialing", "active", "past_due", "cancelled"] },
    "settings.lowStockNotifications": { $ne: false },
    $or: [{ lastLowStockAlertAt: null }, { lastLowStockAlertAt: { $lt: today } }],
  })
    .limit(BATCH)
    .lean();
  let notified = 0;
  for (const t of tenants) {
    const plan = await getEffectivePlan(t);
    await Tenant.updateOne({ _id: t._id }, { $set: { lastLowStockAlertAt: now } });
    if (!hasFeature(plan, "lowStockAlerts")) continue;
    const count = await Product.countDocuments({ tenantId: t._id, isDeleted: false, status: "active", $expr: { $lte: ["$quantity", "$minimumStockLevel"] } });
    if (!count) continue;
    await notify({
      tenantId: t._id,
      roles: ["owner", "admin", "manager", "inventory_staff"],
      type: "low_stock",
      severity: "warning",
      title: `${count} product${count === 1 ? " is" : "s are"} running low`,
      message: "Review your low-stock list and restock before you run out.",
      link: "/inventory/low-stock",
      dedupeKey: `lowdigest:${t._id}:${today.toISOString().slice(0, 10)}`,
      email: true,
      whatsapp: true,
    });
    notified++;
  }
  return { checked: tenants.length, notified };
}

export const CRON_TASKS = {
  "trial-reminders": sendTrialReminders,
  "renewal-reminders": sendRenewalReminders,
  "expire-trials": expireTrials,
  subscriptions: processSubscriptionExpiry,
  payments: reconcilePendingPayments,
  "sync-subscriptions": syncSubscriptions,
  "low-stock": lowStockDigest,
  "referral-credits": applyAllPendingCredits,
};

export async function runCron(task = "all") {
  await connectDB();
  const tasks = task === "all" ? Object.keys(CRON_TASKS) : [task];
  const results = {};
  for (const name of tasks) {
    const fn = CRON_TASKS[name];
    if (!fn) {
      results[name] = { error: "unknown task" };
      continue;
    }
    const started = Date.now();
    try {
      results[name] = { ok: true, ...(await fn(new Date())), ms: Date.now() - started };
    } catch (err) {
      console.error(`[cron] ${name} failed`, err);
      results[name] = { ok: false, error: err?.message };
    }
  }
  return results;
}
