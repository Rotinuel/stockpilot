// Referral programme.
//
//  • Every business gets a referral code/link (created the first time it's needed).
//  • A new business that signs up through the link is recorded as a Referral (signed_up).
//  • When that business makes its FIRST successful payment, the referrer is rewarded once,
//    using the Super Admin settings at that moment: free subscription days, a cash
//    commission (paid out manually from the Super Admin panel), or both.
//  • Rewards never fail a payment: everything here is best-effort and idempotent.
import crypto from "node:crypto";
import mongoose from "mongoose";
import Tenant from "../models/Tenant.js";
import User from "../models/User.js";
import Referral from "../models/Referral.js";
import Subscription from "../models/Subscription.js";
import { paystack, isPaystackConfigured } from "../lib/paystack.js";
import { addDays } from "../lib/access.js";
import { appUrl } from "../lib/request.js";
import { badRequest, notFound } from "../lib/errors.js";
import { formatMoney } from "../lib/money.js";
import { buildReferralCode, codePrefix, commissionFor, normalizeReferralCode, rewardParts } from "../lib/referrals.js";
import { getPlatformSettings } from "./platform.js";
import { getEffectivePlan } from "./plans.js";
import { notify } from "./notifications.js";
import { logAudit } from "./audit.js";

const system = (tenantId) => ({ tenantId, userName: "Referral programme", role: "system" });

// ── Codes & links ───────────────────────────────────────────
export function referralLink(code) {
  return appUrl(`/register?ref=${encodeURIComponent(code)}`);
}

/** Returns the business's referral code, creating a unique one on first use. */
export async function ensureReferralCode(tenantId) {
  const tenant = await Tenant.findById(tenantId).select("businessName referralCode").lean();
  if (!tenant) throw notFound();
  if (tenant.referralCode) return tenant.referralCode;
  const prefix = codePrefix(tenant.businessName);
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = buildReferralCode(prefix, crypto.randomBytes(attempt < 4 ? 4 : 6));
    try {
      const res = await Tenant.updateOne({ _id: tenantId, $or: [{ referralCode: null }, { referralCode: { $exists: false } }, { referralCode: "" }] }, { $set: { referralCode: code } });
      if (res.modifiedCount) return code;
      const again = await Tenant.findById(tenantId).select("referralCode").lean(); // set concurrently
      if (again?.referralCode) return again.referralCode;
    } catch (err) {
      if (err?.code !== 11000) throw err; // code taken — try another
    }
  }
  throw new Error("Could not generate a referral code.");
}

/** Public lookup used on the sign-up page ("Invited by …"). */
export async function findReferrer(code) {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  const platform = await getPlatformSettings();
  if (!platform.referral?.enabled) return null;
  const tenant = await Tenant.findOne({ referralCode: normalized, status: "active" }).select("businessName referralCode ownerId email phone").lean();
  return tenant || null;
}

// ── Sign-up ─────────────────────────────────────────────────
/**
 * Link a newly registered business to the business that referred it.
 * Silently ignores unknown codes and self-referrals — sign-up must never fail because of this.
 */
export async function attachReferral({ tenantId, code, email, phone, request }) {
  try {
    const referrer = await findReferrer(code);
    if (!referrer || String(referrer._id) === String(tenantId)) return null;
    // Self-referral guard: same owner email or phone as the referrer.
    const owner = await User.findById(referrer.ownerId).select("email phone").lean();
    const sameEmail = email && [referrer.email, owner?.email].filter(Boolean).some((e) => e.toLowerCase() === email.toLowerCase());
    const samePhone = phone && [referrer.phone, owner?.phone].filter(Boolean).includes(phone);
    if (sameEmail || samePhone) return null;

    const newTenant = await Tenant.findById(tenantId).select("businessName").lean();
    const referral = await Referral.create({ referrerTenantId: referrer._id, referredTenantId: tenantId, code: referrer.referralCode });
    await Tenant.updateOne({ _id: tenantId }, { $set: { referredBy: referrer._id } });
    await logAudit(system(referrer._id), "referral.signed_up", { entity: "Referral", entityId: referral._id, metadata: { referred: newTenant?.businessName }, request });
    await notify({
      tenantId: referrer._id,
      roles: ["owner", "admin"],
      type: "referral",
      severity: "info",
      title: `${newTenant?.businessName || "A business"} joined with your link`,
      message: "You'll get your reward when they pay for their first subscription.",
      link: "/referrals",
      dedupeKey: `ref-signup:${referral._id}`,
    });
    return referral;
  } catch (err) {
    if (err?.code !== 11000) console.warn("[referrals] could not attach referral", err?.message);
    return null;
  }
}

// ── Rewards ─────────────────────────────────────────────────
/**
 * Push a paid subscription's end date back by `days`. When the business pays by card through a
 * Paystack subscription, the recurring subscription is moved so the next charge happens on the
 * new date (disable the current one, create a new one starting then). If Paystack can't be
 * updated, the local end date is still extended, so the days are kept as credit.
 */
export async function extendPaidSubscription(tenantId, days, reason = "referral") {
  const tenant = await Tenant.findById(tenantId).select("+paystackEmailToken +paystackAuthorizationCode").lean();
  if (!tenant || days <= 0) return { applied: false };
  const now = new Date();
  const base = tenant.subscriptionEndDate && new Date(tenant.subscriptionEndDate) > now ? new Date(tenant.subscriptionEndDate) : now;
  const newEnd = addDays(base, days);
  const $set = { subscriptionEndDate: newEnd };
  if (tenant.nextBillingDate || tenant.subscriptionStatus === "active") $set.nextBillingDate = newEnd;

  let rescheduled = false;
  const canReschedule =
    tenant.subscriptionStatus === "active" && isPaystackConfigured() && tenant.paystackSubscriptionCode && tenant.paystackEmailToken && tenant.paystackCustomerCode && tenant.paystackAuthorizationCode;
  if (canReschedule) {
    const plan = await getEffectivePlan(tenant);
    const oldCode = tenant.paystackSubscriptionCode;
    if (plan?.paystackPlanCode) {
      // Mark first so the "subscription.disable" webhook for the old code isn't read as a cancellation.
      await Tenant.updateOne({ _id: tenant._id }, { $set: { paystackRescheduledFrom: oldCode } });
      let disabled = false;
      try {
        await paystack.disableSubscription({ code: oldCode, token: tenant.paystackEmailToken });
        disabled = true;
        const created = await paystack.createSubscription({ customer: tenant.paystackCustomerCode, plan: plan.paystackPlanCode, authorization: tenant.paystackAuthorizationCode, startDate: newEnd });
        if (created?.subscription_code) $set.paystackSubscriptionCode = created.subscription_code;
        if (created?.email_token) $set.paystackEmailToken = created.email_token;
        rescheduled = true;
      } catch (err) {
        console.warn("[referrals] could not move the Paystack renewal date", err?.message);
        if (disabled) {
          // Put the original subscription back so the business keeps renewing.
          await paystack.enableSubscription({ code: oldCode, token: tenant.paystackEmailToken }).catch((e) => console.error("[referrals] could not re-enable subscription", oldCode, e?.message));
        }
        await Tenant.updateOne({ _id: tenant._id }, { $set: { paystackRescheduledFrom: "" } });
      }
    }
  }
  await Tenant.updateOne({ _id: tenant._id }, { $set });
  await logAudit(system(tenant._id), "subscription.extended", { entity: "Tenant", entityId: tenant._id, metadata: { days, reason, newEnd, rescheduledOnPaystack: rescheduled } });
  return { applied: true, newEnd, rescheduled };
}

/** Give `days` to a business in whatever way fits its current state. */
async function giveFreeDays(tenantId, days) {
  const tenant = await Tenant.findById(tenantId).select("subscriptionStatus trialEndsAt").lean();
  if (!tenant || days <= 0) return "none";
  const now = new Date();
  if (tenant.subscriptionStatus === "trialing") {
    const base = tenant.trialEndsAt && new Date(tenant.trialEndsAt) > now ? new Date(tenant.trialEndsAt) : now;
    const trialEndsAt = addDays(base, days);
    await Tenant.updateOne({ _id: tenantId }, { $set: { trialEndsAt }, $pull: { remindersSent: { $in: ["trial-1", "trial-3", "trial-5", "trial-expired"] } } });
    await Subscription.updateMany({ tenantId, status: "trialing" }, { $set: { currentPeriodEnd: trialEndsAt } });
    await logAudit(system(tenantId), "subscription.trial_extended", { entity: "Tenant", entityId: tenantId, metadata: { days, reason: "referral", trialEndsAt } });
    return "trial";
  }
  if (["active", "cancelled"].includes(tenant.subscriptionStatus)) {
    await extendPaidSubscription(tenantId, days, "referral");
    return "subscription";
  }
  // past_due / expired: keep the days and add them when the business next pays.
  await Tenant.updateOne({ _id: tenantId }, { $inc: { referralCreditDays: days } });
  return "credit";
}

/**
 * Called after every successful subscription payment. Rewards the referrer the first time
 * the referred business pays. Safe to call repeatedly (only one call can claim the referral).
 */
export async function rewardReferralForPayment(payment) {
  try {
    if (!payment?.tenantId || !(Number(payment.amount) > 0)) return null;
    const platform = await getPlatformSettings();
    const { days, percent } = rewardParts(platform.referral);
    const commission = commissionFor(payment.amount, percent);
    const referral = await Referral.findOneAndUpdate(
      { referredTenantId: payment.tenantId, status: "signed_up" },
      {
        $set: {
          status: "rewarded",
          qualifiedAt: new Date(),
          paymentId: payment._id,
          paymentAmount: payment.amount,
          currency: payment.currency || "NGN",
          rewardDays: days,
          commissionPercent: percent,
          commissionAmount: commission,
          commissionStatus: commission > 0 ? "owed" : "none",
        },
      },
      { new: true },
    ).lean();
    if (!referral) return null; // not referred, already rewarded, or voided

    const daysApplied = days > 0 ? await giveFreeDays(referral.referrerTenantId, days) : "none";
    await Referral.updateOne({ _id: referral._id }, { $set: { daysApplied } });

    const referred = await Tenant.findById(payment.tenantId).select("businessName").lean();
    const rewards = [];
    if (days > 0) rewards.push(daysApplied === "credit" ? `${days} free days (added when you renew)` : `${days} free days`);
    if (commission > 0) rewards.push(`${formatMoney(commission, referral.currency)} commission`);
    await logAudit(system(referral.referrerTenantId), "referral.rewarded", { entity: "Referral", entityId: referral._id, metadata: { referred: referred?.businessName, days, daysApplied, commission } });
    await notify({
      tenantId: referral.referrerTenantId,
      roles: ["owner", "admin"],
      type: "referral",
      severity: "success",
      title: "You earned a referral reward",
      message: `${referred?.businessName || "A business you referred"} just subscribed. You've earned ${rewards.join(" and ") || "a reward"}.`,
      link: "/referrals",
      dedupeKey: `ref-reward:${referral._id}`,
      email: true,
      whatsapp: true,
    });
    return referral;
  } catch (err) {
    console.error("[referrals] reward failed", err?.message);
    return null;
  }
}

/** Apply free days that were waiting for a business to become active again. */
export async function applyPendingReferralCredit(tenantId) {
  const tenant = await Tenant.findOneAndUpdate(
    { _id: tenantId, subscriptionStatus: "active", referralCreditDays: { $gt: 0 } },
    { $set: { referralCreditDays: 0 } },
    { new: false },
  ).lean();
  if (!tenant) return null;
  try {
    return await extendPaidSubscription(tenantId, tenant.referralCreditDays, "referral_credit");
  } catch (err) {
    await Tenant.updateOne({ _id: tenantId }, { $inc: { referralCreditDays: tenant.referralCreditDays } }); // try again later
    throw err;
  }
}

/** Cron: apply waiting credit for businesses that are active again. */
export async function applyAllPendingCredits() {
  const tenants = await Tenant.find({ subscriptionStatus: "active", referralCreditDays: { $gt: 0 } }).select("_id").limit(100).lean();
  let applied = 0;
  for (const t of tenants) {
    try {
      if (await applyPendingReferralCredit(t._id)) applied++;
    } catch (err) {
      console.warn("[referrals] credit failed", t._id, err?.message);
    }
  }
  return { checked: tenants.length, applied };
}

// ── Business-facing overview ────────────────────────────────
export async function getReferralOverview(ctx) {
  const platform = await getPlatformSettings();
  const code = await ensureReferralCode(ctx.tenantId);
  const tenant = await Tenant.findById(ctx.tenantId).select("referralPayout referralCreditDays currency").lean();
  const referrals = await Referral.find({ referrerTenantId: ctx.tenantId }).sort({ createdAt: -1 }).limit(200).lean();
  const names = new Map(
    (await Tenant.find({ _id: { $in: referrals.map((r) => r.referredTenantId) } }).select("businessName").lean()).map((t) => [String(t._id), t.businessName]),
  );
  const sum = (list, key) => Math.round(list.reduce((a, r) => a + (Number(r[key]) || 0), 0) * 100) / 100;
  const rewarded = referrals.filter((r) => r.status === "rewarded");
  return {
    code,
    link: referralLink(code),
    settings: platform.referral,
    payout: tenant?.referralPayout || {},
    pendingCreditDays: tenant?.referralCreditDays || 0,
    stats: {
      signedUp: referrals.filter((r) => r.status !== "void").length,
      paying: rewarded.length,
      daysEarned: rewarded.reduce((a, r) => a + (r.rewardDays || 0), 0),
      commissionOwed: sum(rewarded.filter((r) => r.commissionStatus === "owed"), "commissionAmount"),
      commissionPaid: sum(rewarded.filter((r) => r.commissionStatus === "paid"), "commissionAmount"),
    },
    referrals: referrals.map((r) => ({
      _id: String(r._id),
      businessName: names.get(String(r.referredTenantId)) || "Business",
      status: r.status,
      signedUpAt: r.signedUpAt || r.createdAt,
      qualifiedAt: r.qualifiedAt || null,
      rewardDays: r.rewardDays || 0,
      commissionAmount: r.commissionAmount || 0,
      commissionStatus: r.commissionStatus,
      currency: r.currency || "NGN",
    })),
  };
}

export async function updatePayoutDetails(ctx, data, request) {
  await Tenant.updateOne({ _id: ctx.tenantId }, { $set: { referralPayout: { bankName: data.bankName, accountNumber: data.accountNumber, accountName: data.accountName } } });
  await logAudit(ctx, "referral.payout_details_updated", { entity: "Tenant", entityId: ctx.tenantId, metadata: { bankName: data.bankName, accountEnding: data.accountNumber.slice(-4) }, request });
  return { ok: true };
}

// ── Super admin ─────────────────────────────────────────────
export async function listReferralsAdmin({ page = 1, limit = 25, commission, status } = {}) {
  const skip = (page - 1) * limit;
  const filter = {};
  if (["owed", "paid", "void", "none"].includes(commission)) filter.commissionStatus = commission;
  if (["signed_up", "rewarded", "void"].includes(status)) filter.status = status;
  const [items, total, owedAgg, paidAgg, counts] = await Promise.all([
    Referral.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Referral.countDocuments(filter),
    Referral.aggregate([{ $match: { commissionStatus: "owed" } }, { $group: { _id: null, total: { $sum: "$commissionAmount" }, count: { $sum: 1 } } }]),
    Referral.aggregate([{ $match: { commissionStatus: "paid" } }, { $group: { _id: null, total: { $sum: "$commissionAmount" }, count: { $sum: 1 } } }]),
    Referral.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  const ids = [...new Set(items.flatMap((r) => [String(r.referrerTenantId), String(r.referredTenantId)]))].map((id) => new mongoose.Types.ObjectId(id));
  const tenants = new Map((await Tenant.find({ _id: { $in: ids } }).select("businessName referralPayout").lean()).map((t) => [String(t._id), t]));
  const byStatus = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  return {
    items: items.map((r) => ({
      ...r,
      referrerName: tenants.get(String(r.referrerTenantId))?.businessName || "—",
      referredName: tenants.get(String(r.referredTenantId))?.businessName || "—",
      payout: tenants.get(String(r.referrerTenantId))?.referralPayout || null,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    summary: {
      total: counts.reduce((a, c) => a + c.count, 0),
      rewarded: byStatus.rewarded || 0,
      owed: owedAgg[0]?.total || 0,
      owedCount: owedAgg[0]?.count || 0,
      paid: paidAgg[0]?.total || 0,
    },
  };
}

export async function adminReferralAction(id, { action, note }, admin, request) {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  const referral = await Referral.findById(id).lean();
  if (!referral) throw notFound("Referral not found.");
  let update;
  if (action === "mark_paid") {
    if (referral.commissionStatus !== "owed") throw badRequest("Only an owed commission can be marked as paid.");
    update = { commissionStatus: "paid", commissionPaidAt: new Date(), commissionPaidBy: admin._id, payoutNote: note || "" };
  } else if (action === "mark_owed") {
    if (referral.commissionStatus !== "paid") throw badRequest("Only a paid commission can be moved back to owed.");
    update = { commissionStatus: "owed", commissionPaidAt: null, commissionPaidBy: null };
  } else {
    if (referral.status === "void") throw badRequest("This referral is already void.");
    if (referral.commissionStatus === "paid") throw badRequest("This commission was already paid out.");
    // Free days that were already given are not taken back.
    update = { status: "void", voidReason: note || "", ...(referral.commissionStatus === "owed" ? { commissionStatus: "void" } : {}) };
  }
  const updated = await Referral.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  await logAudit({ userId: admin._id, userName: admin.name, role: "super_admin" }, `referral.${action}`, { tenantId: referral.referrerTenantId, entity: "Referral", entityId: referral._id, metadata: { amount: referral.commissionAmount, note }, request });
  if (action === "mark_paid") {
    await notify({
      tenantId: referral.referrerTenantId,
      roles: ["owner"],
      type: "referral",
      severity: "success",
      title: "Referral commission paid",
      message: `${formatMoney(referral.commissionAmount, referral.currency)} has been sent to your bank account.${note ? ` Note: ${note}` : ""}`,
      link: "/referrals",
      dedupeKey: `ref-paid:${referral._id}`,
      email: true,
    });
  }
  return { referral: updated };
}
