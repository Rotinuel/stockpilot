// Subscription billing with Paystack.
//
// Rules:
//  • Payment status is NEVER taken from the browser. Every success is confirmed
//    with GET /transaction/verify/:reference (callback, webhook and cron paths).
//  • All state transitions are idempotent (payments are marked success atomically).
//  • Data is never deleted when a subscription lapses — the tenant becomes read-only.
import Tenant from "../models/Tenant.js";
import User from "../models/User.js";
import Payment from "../models/Payment.js";
import Subscription from "../models/Subscription.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import { paystack, isPaystackConfigured } from "../lib/paystack.js";
import { toSubunit, fromSubunit, round2 } from "../lib/money.js";
import { randomReference } from "../lib/auth/tokens.js";
import { appUrl } from "../lib/request.js";
import { addDays } from "../lib/access.js";
import { limitViolations, limitLabel } from "../lib/plans.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { getPlanById, getPlanByCode, getPaidPlans, getEffectivePlan, invalidatePlanCache } from "./plans.js";
import { getPlatformSettings } from "./platform.js";
import { getUsage } from "./limits.js";
import { logAudit } from "./audit.js";
import { notify } from "./notifications.js";

const MONTHS = { monthly: 1, quarterly: 3, biannually: 6, annually: 12 };

export function addInterval(date, interval = "monthly") {
  const d = new Date(date);
  const months = MONTHS[interval] || 1;
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0); // clamp e.g. Jan 31 → Feb 28
  return d;
}

function parseMetadata(meta) {
  if (!meta) return {};
  if (typeof meta === "object") return meta;
  try {
    return JSON.parse(meta);
  } catch {
    return {};
  }
}

// ── Overview ────────────────────────────────────────────────
export async function getBillingOverview(ctx) {
  const [tenant, plans, payments, usage] = await Promise.all([
    Tenant.findById(ctx.tenantId).lean(),
    getPaidPlans(),
    Payment.find({ tenantId: ctx.tenantId }).sort({ createdAt: -1 }).limit(24).lean(),
    getUsage(ctx.tenantId, { timezone: ctx.timezone }),
  ]);
  const currentPlan = await getEffectivePlan(tenant);
  const pendingPlan = tenant.pendingPlanChange?.planId ? await getPlanById(tenant.pendingPlanChange.planId) : null;
  return { tenant, currentPlan, plans, payments, usage, pendingPlan, paystackConfigured: isPaystackConfigured() };
}

// ── Paystack plan sync ──────────────────────────────────────
export async function ensurePaystackPlan(plan) {
  if (plan.paystackPlanCode) return plan.paystackPlanCode;
  const created = await paystack.createPlan({
    name: `StockPilot ${plan.name}`,
    amount: toSubunit(plan.price),
    interval: plan.interval,
    currency: plan.currency || "NGN",
    description: plan.description,
  });
  await SubscriptionPlan.updateOne({ _id: plan._id }, { $set: { paystackPlanCode: created.plan_code } });
  invalidatePlanCache();
  return created.plan_code;
}

export async function syncPlanToPaystack(planId) {
  const plan = await SubscriptionPlan.findById(planId).lean();
  if (!plan) throw notFound("Plan not found.");
  if (plan.isTrial || plan.price <= 0) throw badRequest("Free/trial plans are not billed through Paystack.");
  if (!plan.paystackPlanCode) return { planCode: await ensurePaystackPlan(plan), created: true };
  await paystack.updatePlan(plan.paystackPlanCode, {
    name: `StockPilot ${plan.name}`,
    amount: toSubunit(plan.price),
    interval: plan.interval,
    currency: plan.currency || "NGN",
    description: plan.description,
    updateExisting: false, // existing subscribers keep their price until they change plan
  });
  return { planCode: plan.paystackPlanCode, updated: true };
}

// ── Checkout ────────────────────────────────────────────────
async function ownerOf(tenant) {
  return User.findOne({ _id: tenant.ownerId, tenantId: tenant._id }).select("name email").lean();
}

/**
 * Start a Paystack checkout for `planId`. Returns the hosted authorization URL.
 * @param {'subscription'|'upgrade'|'renewal'} [purposeHint]
 */
export async function startCheckout(ctx, planId, request, purposeHint) {
  const plan = await getPlanById(planId);
  if (!plan || !plan.isActive || plan.isTrial || plan.price <= 0) throw badRequest("Please choose a valid paid plan.");
  const tenant = await Tenant.findById(ctx.tenantId).lean();
  const access = ctx.access;

  const isCurrentlyPaid = ["active", "cancelled", "past_due"].includes(access?.state) && tenant.subscriptionStatus !== "trialing";
  if (isCurrentlyPaid && String(tenant.subscriptionPlan) === String(plan._id) && access.state === "active") {
    throw conflict(`You are already subscribed to the ${plan.name} plan.`);
  }

  let purpose = purposeHint || "subscription";
  if (!purposeHint && isCurrentlyPaid) {
    const current = await getEffectivePlan(tenant);
    purpose = String(current._id) === String(plan._id) ? "renewal" : plan.price > current.price ? "upgrade" : "subscription";
  }

  const owner = await ownerOf(tenant);
  if (!owner?.email) throw badRequest("The business owner's email is missing.");
  const planCode = await ensurePaystackPlan(plan);
  const reference = randomReference("SP");

  const payment = await Payment.create({
    tenantId: tenant._id,
    planId: plan._id,
    planCode: plan.code,
    reference,
    amount: round2(plan.price),
    currency: plan.currency || "NGN",
    status: "pending",
    purpose,
    initiatedBy: ctx.userId,
    customerEmail: owner.email,
  });

  let init;
  try {
    init = await paystack.initializeTransaction({
      email: owner.email,
      amount: toSubunit(plan.price),
      reference,
      callbackUrl: appUrl("/billing/callback"),
      plan: planCode,
      currency: plan.currency || "NGN",
      metadata: {
        tenantId: String(tenant._id),
        planId: String(plan._id),
        paymentId: String(payment._id),
        purpose,
        custom_fields: [
          { display_name: "Business", variable_name: "business", value: tenant.businessName },
          { display_name: "Plan", variable_name: "plan", value: plan.name },
        ],
      },
    });
  } catch (err) {
    await Payment.updateOne({ _id: payment._id }, { $set: { status: "failed", failureReason: err?.message?.slice(0, 300) } });
    throw err;
  }

  await logAudit(ctx, "subscription.checkout", { entity: "Payment", entityId: payment._id, metadata: { plan: plan.code, amount: plan.price, purpose, reference }, request });
  return { authorizationUrl: init.authorization_url, accessCode: init.access_code, reference };
}

// ── Verification & activation ───────────────────────────────
/**
 * Verify a transaction with Paystack and apply it. Safe to call repeatedly
 * (browser callback, webhook, cron reconciliation).
 * @param {{expectedTenantId?: any, via?: 'callback'|'webhook'|'cron'|'admin'}} opts
 */
export async function verifyAndApply(reference, { expectedTenantId, via = "callback" } = {}) {
  const payment = await Payment.findOne({ reference }).lean();
  if (!payment) throw notFound("Payment not found.");
  if (expectedTenantId && String(payment.tenantId) !== String(expectedTenantId)) throw notFound("Payment not found."); // IDOR guard
  if (payment.status === "success") return { status: "success", alreadyProcessed: true, payment };

  const tx = await paystack.verifyTransaction(reference);
  const meta = parseMetadata(tx.metadata);
  if (meta.tenantId && String(meta.tenantId) !== String(payment.tenantId)) {
    console.error("[billing] metadata tenant mismatch for", reference);
    throw forbidden("Payment does not belong to this account.");
  }

  if (tx.status === "success") {
    if (Number(tx.amount) < toSubunit(payment.amount) || (tx.currency && payment.currency && tx.currency !== payment.currency)) {
      await Payment.updateOne({ _id: payment._id }, { $set: { status: "failed", failureReason: "Amount/currency mismatch", gatewayResponse: tx.gateway_response } });
      console.error("[billing] amount mismatch", reference, tx.amount, payment.amount);
      throw badRequest("Payment amount did not match the plan price. Please contact support.");
    }
    const result = await applySuccessfulPayment(payment, tx, via);
    return { status: "success", ...result };
  }

  if (["failed", "abandoned", "reversed"].includes(tx.status)) {
    const updated = await Payment.findOneAndUpdate(
      { _id: payment._id, status: "pending" },
      { $set: { status: tx.status, gatewayResponse: tx.gateway_response, failureReason: tx.gateway_response, verifiedAt: new Date(), verifiedVia: via } },
      { new: true },
    ).lean();
    if (updated && tx.status === "failed") {
      await notify({
        tenantId: payment.tenantId,
        roles: ["owner", "admin"],
        type: "payment_failed",
        severity: "danger",
        title: "Payment failed",
        message: `Your payment of ${payment.currency} ${payment.amount.toLocaleString("en-NG")} was not successful${tx.gateway_response ? `: ${tx.gateway_response}` : "."}`,
        link: "/billing",
        dedupeKey: `payfail:${payment.reference}`,
        email: true,
      });
    }
    return { status: tx.status, payment: updated || payment };
  }

  return { status: tx.status || "pending", payment };
}

async function applySuccessfulPayment(payment, tx, via) {
  const now = new Date();
  const marked = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: "success" } },
    {
      $set: {
        status: "success",
        paidAt: tx.paid_at ? new Date(tx.paid_at) : now,
        channel: tx.channel,
        gatewayResponse: tx.gateway_response,
        paystackTransactionId: String(tx.id || ""),
        verifiedAt: now,
        verifiedVia: via,
        cardLast4: tx.authorization?.last4,
        cardBrand: tx.authorization?.brand,
      },
    },
    { new: true },
  ).lean();
  if (!marked) return { alreadyProcessed: true }; // processed concurrently

  const plan = (await getPlanById(payment.planId)) || (tx.plan?.plan_code ? await SubscriptionPlan.findOne({ paystackPlanCode: tx.plan.plan_code }).lean() : null);
  const tenant = await Tenant.findById(payment.tenantId).select("+paystackEmailToken +paystackAuthorizationCode").lean();
  if (!plan || !tenant) return { alreadyProcessed: false };

  // Upgrading from another paid plan: stop the old recurring subscription.
  const previousCode = tenant.paystackSubscriptionCode;
  if (previousCode && String(tenant.subscriptionPlan) !== String(plan._id) && tenant.paystackEmailToken) {
    try {
      await paystack.disableSubscription({ code: previousCode, token: tenant.paystackEmailToken });
    } catch (err) {
      console.warn("[billing] could not disable previous subscription", previousCode, err?.message);
    }
  }

  const start = payment.purpose === "renewal" && tenant.subscriptionEndDate && new Date(tenant.subscriptionEndDate) > now ? new Date(tenant.subscriptionEndDate) : now;
  const end = addInterval(start, plan.interval);

  await Subscription.updateMany(
    { tenantId: tenant._id, status: { $in: ["trialing", "active", "past_due", "cancelled"] } },
    { $set: { status: "expired", endedAt: now } },
  );
  const sub = await Subscription.create({
    tenantId: tenant._id,
    planId: plan._id,
    planCode: plan.code,
    status: "active",
    amount: payment.amount,
    currency: payment.currency,
    interval: plan.interval,
    paystackPlanCode: plan.paystackPlanCode,
    paystackCustomerCode: tx.customer?.customer_code,
    currentPeriodStart: start,
    currentPeriodEnd: end,
    nextPaymentDate: end,
    changeType: payment.purpose === "upgrade" ? "upgrade" : payment.purpose === "renewal" ? "renewal" : "new",
    createdBy: payment.initiatedBy,
  });

  const $set = {
    subscriptionPlan: plan._id,
    subscriptionPlanCode: plan.code,
    subscriptionStatus: "active",
    subscriptionStartDate: start,
    subscriptionEndDate: end,
    nextBillingDate: end,
    cancelAtPeriodEnd: false,
    cardLast4: tx.authorization?.last4 || tenant.cardLast4,
    cardBrand: tx.authorization?.brand || tenant.cardBrand,
  };
  if (tx.customer?.customer_code) $set.paystackCustomerCode = tx.customer.customer_code;
  if (tx.authorization?.reusable && tx.authorization?.authorization_code) $set.paystackAuthorizationCode = tx.authorization.authorization_code;
  if (previousCode && String(tenant.subscriptionPlan) !== String(plan._id)) $set.paystackSubscriptionCode = null; // new code arrives via subscription.create

  await Tenant.updateOne(
    { _id: tenant._id },
    { $set, $unset: { pastDueSince: 1, graceEndsAt: 1, cancelledAt: 1, pendingPlanChange: 1 } },
  );
  await Payment.updateOne({ _id: payment._id }, { $set: { subscriptionId: sub._id } });

  const actor = { tenantId: tenant._id, userId: payment.initiatedBy, userName: "Paystack", role: "system" };
  await logAudit(actor, "payment.success", { entity: "Payment", entityId: payment._id, metadata: { reference: payment.reference, amount: payment.amount, plan: plan.code, via } });
  await logAudit(actor, "subscription.change", { entity: "Subscription", entityId: sub._id, metadata: { plan: plan.code, status: "active", periodEnd: end, purpose: payment.purpose } });
  await notify({
    tenantId: tenant._id,
    roles: ["owner", "admin"],
    type: payment.purpose === "renewal" ? "subscription_renewed" : "payment_success",
    severity: "success",
    title: payment.purpose === "renewal" ? "Subscription renewed" : `You're on the ${plan.name} plan`,
    message: `Payment of ${payment.currency} ${payment.amount.toLocaleString("en-NG")} received. Your subscription is active until ${end.toDateString()}.`,
    link: "/billing",
    dedupeKey: `paysuccess:${payment.reference}`,
    email: true,
  });
  return { alreadyProcessed: false, plan: plan.code, periodEnd: end };
}

// ── Cancellation / resume ───────────────────────────────────
export async function cancelSubscription(ctx, request) {
  const tenant = await Tenant.findById(ctx.tenantId).select("+paystackEmailToken").lean();
  if (tenant.subscriptionStatus === "trialing") throw badRequest("You are on a free trial — there is no paid subscription to cancel.");
  if (!["active", "past_due"].includes(tenant.subscriptionStatus)) throw badRequest("There is no active subscription to cancel.");

  if (tenant.paystackSubscriptionCode && tenant.paystackEmailToken) {
    await paystack.disableSubscription({ code: tenant.paystackSubscriptionCode, token: tenant.paystackEmailToken });
  }
  const now = new Date();
  await Tenant.updateOne(
    { _id: tenant._id },
    { $set: { subscriptionStatus: "cancelled", cancelAtPeriodEnd: true, cancelledAt: now }, $unset: { pendingPlanChange: 1 } },
  );
  await Subscription.updateMany({ tenantId: tenant._id, status: { $in: ["active", "past_due"] } }, { $set: { status: "cancelled", cancelAtPeriodEnd: true, cancelledAt: now } });
  await logAudit(ctx, "subscription.cancel", { entity: "Tenant", entityId: tenant._id, metadata: { plan: tenant.subscriptionPlanCode, accessUntil: tenant.subscriptionEndDate }, request });
  await notify({
    tenantId: tenant._id,
    roles: ["owner", "admin"],
    type: "subscription_cancelled",
    severity: "warning",
    title: "Subscription cancelled",
    message: `Your subscription will not renew. You keep full access until ${tenant.subscriptionEndDate ? new Date(tenant.subscriptionEndDate).toDateString() : "the end of your billing period"}. Your data is never deleted.`,
    link: "/billing",
  });
  return { ok: true, accessUntil: tenant.subscriptionEndDate };
}

export async function resumeSubscription(ctx, request) {
  const tenant = await Tenant.findById(ctx.tenantId).select("+paystackEmailToken").lean();
  if (tenant.subscriptionStatus !== "cancelled" || !tenant.subscriptionEndDate || new Date(tenant.subscriptionEndDate) <= new Date()) {
    throw badRequest("Only a cancelled subscription that has not yet ended can be resumed. Choose a plan to subscribe again.");
  }
  if (!tenant.paystackSubscriptionCode || !tenant.paystackEmailToken) throw badRequest("Please choose a plan to subscribe again.");
  await paystack.enableSubscription({ code: tenant.paystackSubscriptionCode, token: tenant.paystackEmailToken });
  await Tenant.updateOne({ _id: tenant._id }, { $set: { subscriptionStatus: "active", cancelAtPeriodEnd: false }, $unset: { cancelledAt: 1 } });
  await Subscription.updateMany({ tenantId: tenant._id, status: "cancelled", currentPeriodEnd: { $gt: new Date() } }, { $set: { status: "active", cancelAtPeriodEnd: false }, $unset: { cancelledAt: 1 } });
  await logAudit(ctx, "subscription.resume", { entity: "Tenant", entityId: tenant._id, request });
  return { ok: true };
}

// ── Upgrade / downgrade ─────────────────────────────────────
/**
 * Upgrades are charged immediately (new billing period starts today).
 * Downgrades take effect at the end of the current paid period.
 */
export async function changePlan(ctx, planId, request) {
  const target = await getPlanById(planId);
  if (!target || !target.isActive || target.isTrial) throw badRequest("Please choose a valid plan.");
  const tenant = await Tenant.findById(ctx.tenantId).select("+paystackEmailToken +paystackAuthorizationCode").lean();
  const current = await getEffectivePlan(tenant);
  const paidAndActive = ["active", "past_due", "cancelled"].includes(ctx.access?.state) && tenant.subscriptionStatus !== "trialing";

  if (!paidAndActive) return { action: "checkout", ...(await startCheckout(ctx, planId, request)) };
  if (String(current._id) === String(target._id)) {
    if (tenant.subscriptionStatus === "cancelled") return { action: "resume", ...(await resumeSubscription(ctx, request)) };
    throw conflict(`You are already on the ${target.name} plan.`);
  }
  if (target.price > current.price) return { action: "checkout", ...(await startCheckout(ctx, planId, request, "upgrade")) };

  // Downgrade — make sure current usage fits the smaller plan.
  const usage = await getUsage(ctx.tenantId, { timezone: ctx.timezone });
  const violations = limitViolations(usage, target);
  if (violations.length) {
    const list = violations.map((v) => `${v.label}: using ${v.usage}, ${target.name} allows ${limitLabel(v.limit)}`).join("; ");
    throw badRequest(`You can't downgrade yet — ${list}. Remove or archive items first.`, { violations });
  }

  const effectiveAt = tenant.subscriptionEndDate ? new Date(tenant.subscriptionEndDate) : new Date();
  let scheduledOnPaystack = false;
  if (isPaystackConfigured()) {
    const planCode = await ensurePaystackPlan(target);
    if (tenant.paystackSubscriptionCode && tenant.paystackEmailToken) {
      await paystack.disableSubscription({ code: tenant.paystackSubscriptionCode, token: tenant.paystackEmailToken });
    }
    if (tenant.paystackCustomerCode && tenant.paystackAuthorizationCode) {
      try {
        await paystack.createSubscription({ customer: tenant.paystackCustomerCode, plan: planCode, authorization: tenant.paystackAuthorizationCode, startDate: effectiveAt });
        scheduledOnPaystack = true;
      } catch (err) {
        console.warn("[billing] could not schedule downgrade subscription", err?.message);
      }
    }
  }

  await Tenant.updateOne(
    { _id: tenant._id },
    { $set: { pendingPlanChange: { planId: target._id, planCode: target.code, effectiveAt, requestedAt: new Date(), scheduledOnPaystack }, cancelAtPeriodEnd: !scheduledOnPaystack } },
  );
  await logAudit(ctx, "subscription.downgrade_scheduled", { entity: "Tenant", entityId: tenant._id, metadata: { from: current.code, to: target.code, effectiveAt, scheduledOnPaystack }, request });
  await notify({
    tenantId: tenant._id,
    roles: ["owner", "admin"],
    type: "subscription_changed",
    severity: "info",
    title: `Plan change to ${target.name} scheduled`,
    message: `You'll stay on ${current.name} until ${effectiveAt.toDateString()}, then move to ${target.name}.${scheduledOnPaystack ? "" : " You'll be asked to confirm payment for the new plan at that time."}`,
    link: "/billing",
  });
  return { action: "scheduled", effectiveAt, scheduledOnPaystack };
}

export async function cancelPendingChange(ctx, request) {
  const tenant = await Tenant.findById(ctx.tenantId).lean();
  if (!tenant.pendingPlanChange?.planId) throw badRequest("There is no scheduled plan change.");
  await Tenant.updateOne({ _id: tenant._id }, { $unset: { pendingPlanChange: 1 }, $set: { cancelAtPeriodEnd: false } });
  await logAudit(ctx, "subscription.downgrade_cancelled", { entity: "Tenant", entityId: tenant._id, request });
  return { ok: true, note: "Scheduled change removed. If your renewal was already disabled, choose your current plan again to resubscribe." };
}

export async function getManageLink(ctx) {
  const tenant = await Tenant.findById(ctx.tenantId).lean();
  if (!tenant.paystackSubscriptionCode) throw badRequest("No active card subscription found.");
  const data = await paystack.manageLink(tenant.paystackSubscriptionCode);
  return { link: data.link };
}

// ── Webhooks ────────────────────────────────────────────────
async function findTenantForPaystack(data) {
  const meta = parseMetadata(data?.metadata);
  if (meta.tenantId) {
    const t = await Tenant.findById(meta.tenantId).lean().catch(() => null);
    if (t) return t;
  }
  const subCode = data?.subscription_code || data?.subscription?.subscription_code;
  if (subCode) {
    const t = await Tenant.findOne({ paystackSubscriptionCode: subCode }).lean();
    if (t) return t;
    const sub = await Subscription.findOne({ paystackSubscriptionCode: subCode }).lean();
    if (sub) return Tenant.findById(sub.tenantId).lean();
  }
  const customerCode = data?.customer?.customer_code;
  if (customerCode) {
    const t = await Tenant.findOne({ paystackCustomerCode: customerCode }).lean();
    if (t) return t;
  }
  const email = data?.customer?.email;
  if (email) {
    const owner = await User.findOne({ email: String(email).toLowerCase(), role: "owner" }).lean();
    if (owner?.tenantId) return Tenant.findById(owner.tenantId).lean();
  }
  return null;
}

async function handleChargeSuccess(data) {
  const existing = await Payment.findOne({ reference: data.reference }).lean();
  if (existing) return verifyAndApply(data.reference, { via: "webhook" });

  // Recurring charge initiated by Paystack for an existing subscription (renewal).
  const tenant = await findTenantForPaystack(data);
  if (!tenant) return { ignored: "tenant_not_found" };
  const tx = await paystack.verifyTransaction(data.reference); // never trust the webhook body alone
  if (tx.status !== "success") return { ignored: `status_${tx.status}` };
  const plan = (tx.plan?.plan_code && (await SubscriptionPlan.findOne({ paystackPlanCode: tx.plan.plan_code }).lean())) || (await getEffectivePlan(tenant));
  try {
    const payment = await Payment.create({
      tenantId: tenant._id,
      planId: plan._id,
      planCode: plan.code,
      reference: data.reference,
      amount: fromSubunit(tx.amount),
      currency: tx.currency || "NGN",
      status: "pending",
      purpose: "renewal",
      customerEmail: tx.customer?.email,
    });
    return verifyAndApply(payment.reference, { via: "webhook" });
  } catch (err) {
    if (err?.code === 11000) return verifyAndApply(data.reference, { via: "webhook" });
    throw err;
  }
}

async function handleSubscriptionCreate(data) {
  const tenant = await findTenantForPaystack(data);
  if (!tenant) return { ignored: "tenant_not_found" };
  const plan = data.plan?.plan_code ? await SubscriptionPlan.findOne({ paystackPlanCode: data.plan.plan_code }).lean() : null;
  const $set = {
    paystackSubscriptionCode: data.subscription_code,
    paystackEmailToken: data.email_token,
  };
  if (data.customer?.customer_code) $set.paystackCustomerCode = data.customer.customer_code;
  if (data.next_payment_date) $set.nextBillingDate = new Date(data.next_payment_date);
  // Only adopt the new code if it matches the current (or scheduled) plan.
  const matchesCurrent = !plan || String(plan._id) === String(tenant.subscriptionPlan) || String(plan._id) === String(tenant.pendingPlanChange?.planId);
  if (matchesCurrent) {
    await Tenant.updateOne({ _id: tenant._id }, { $set });
    await Subscription.findOneAndUpdate(
      { tenantId: tenant._id, status: "active", ...(plan ? { planId: plan._id } : {}) },
      { $set: { paystackSubscriptionCode: data.subscription_code, paystackEmailToken: data.email_token, nextPaymentDate: $set.nextBillingDate } },
      { sort: { createdAt: -1 } },
    );
  }
  await logAudit({ tenantId: tenant._id, userName: "Paystack", role: "system" }, "subscription.created", { entity: "Tenant", entityId: tenant._id, metadata: { code: data.subscription_code, plan: plan?.code } });
  return { ok: true };
}

async function handleSubscriptionDisable(data, event) {
  const tenant = await findTenantForPaystack(data);
  if (!tenant) return { ignored: "tenant_not_found" };
  if (tenant.paystackSubscriptionCode !== data.subscription_code) return { ignored: "not_current_subscription" };
  if (tenant.pendingPlanChange?.planId) return { ignored: "scheduled_change" }; // we disabled it for a downgrade
  if (!["active", "past_due"].includes(tenant.subscriptionStatus)) return { ignored: "not_active" };
  await Tenant.updateOne({ _id: tenant._id }, { $set: { subscriptionStatus: "cancelled", cancelAtPeriodEnd: true, cancelledAt: new Date() } });
  await Subscription.updateMany({ tenantId: tenant._id, paystackSubscriptionCode: data.subscription_code }, { $set: { status: "cancelled", cancelledAt: new Date() } });
  await logAudit({ tenantId: tenant._id, userName: "Paystack", role: "system" }, "subscription.disabled", { entity: "Tenant", entityId: tenant._id, metadata: { event, code: data.subscription_code } });
  await notify({
    tenantId: tenant._id,
    roles: ["owner", "admin"],
    type: "subscription_cancelled",
    severity: "warning",
    title: "Subscription will not renew",
    message: "Your subscription was cancelled with the payment provider. You keep access until the end of the current period.",
    link: "/billing",
    dedupeKey: `subdisable:${data.subscription_code}`,
  });
  return { ok: true };
}

async function markPastDue(tenant, reason, reference) {
  const platform = await getPlatformSettings();
  const now = new Date();
  const base = tenant.subscriptionEndDate && new Date(tenant.subscriptionEndDate) > now ? new Date(tenant.subscriptionEndDate) : now;
  const graceEndsAt = addDays(base, platform.gracePeriodDays);
  await Tenant.updateOne(
    { _id: tenant._id, subscriptionStatus: { $in: ["active", "past_due"] } },
    { $set: { subscriptionStatus: "past_due", pastDueSince: tenant.pastDueSince || now, graceEndsAt } },
  );
  await notify({
    tenantId: tenant._id,
    roles: ["owner", "admin"],
    type: "payment_failed",
    severity: "danger",
    title: "Subscription payment failed",
    message: `${reason || "We couldn't charge your card."} Update your payment method before ${graceEndsAt.toDateString()} to keep full access.`,
    link: "/billing",
    dedupeKey: `pastdue:${tenant._id}:${reference || now.toISOString().slice(0, 10)}`,
    email: true,
  });
  await logAudit({ tenantId: tenant._id, userName: "Paystack", role: "system" }, "subscription.past_due", { entity: "Tenant", entityId: tenant._id, metadata: { reason, graceEndsAt } });
}

async function handleInvoiceFailed(data) {
  const tenant = await findTenantForPaystack(data);
  if (!tenant) return { ignored: "tenant_not_found" };
  const reference = data.transaction?.reference || data.invoice_code || `INV_FAIL_${Date.now()}`;
  await Payment.updateOne(
    { reference },
    {
      $setOnInsert: {
        tenantId: tenant._id,
        planId: tenant.subscriptionPlan,
        planCode: tenant.subscriptionPlanCode,
        reference,
        amount: fromSubunit(data.amount || 0),
        currency: data.currency || "NGN",
        purpose: "renewal",
        paystackInvoiceCode: data.invoice_code,
      },
      $set: { status: "failed", failureReason: data.description || "Renewal charge failed" },
    },
    { upsert: true },
  );
  await markPastDue(tenant, "Your subscription renewal payment failed.", reference);
  return { ok: true };
}

async function handleChargeFailed(data) {
  if (data?.reference) {
    const payment = await Payment.findOne({ reference: data.reference }).lean();
    if (payment && payment.status === "pending") return verifyAndApply(data.reference, { via: "webhook" });
  }
  const tenant = await findTenantForPaystack(data);
  if (tenant && ["active", "past_due"].includes(tenant.subscriptionStatus) && data?.plan?.plan_code) {
    await markPastDue(tenant, data.gateway_response || "A subscription charge failed.", data.reference);
  }
  return { ok: true };
}

/** Dispatch a verified Paystack webhook event. */
export async function handlePaystackEvent(event) {
  const data = event?.data || {};
  switch (event?.event) {
    case "charge.success":
      return handleChargeSuccess(data);
    case "subscription.create":
      return handleSubscriptionCreate(data);
    case "subscription.disable":
    case "subscription.not_renew":
      return handleSubscriptionDisable(data, event.event);
    case "invoice.payment_failed":
      return handleInvoiceFailed(data);
    case "invoice.update":
      // Paid invoices are handled through charge.success; unpaid+failed means a failed renewal.
      if (data.paid === false && data.status === "failed") return handleInvoiceFailed(data);
      return { ignored: "invoice_update" };
    case "invoice.create":
      return { ignored: "invoice_create" };
    case "charge.failed":
      return handleChargeFailed(data);
    default:
      return { ignored: event?.event || "unknown" };
  }
}

// ── Scheduled jobs (called by services/cron.js) ─────────────
export async function syncSubscriptionFromPaystack(tenant) {
  if (!tenant.paystackSubscriptionCode || !isPaystackConfigured()) return null;
  const sub = await paystack.fetchSubscription(tenant.paystackSubscriptionCode);
  const $set = {};
  if (sub.next_payment_date) $set.nextBillingDate = new Date(sub.next_payment_date);
  if (["non-renewing", "cancelled", "complete"].includes(sub.status) && tenant.subscriptionStatus === "active" && !tenant.pendingPlanChange?.planId) {
    $set.subscriptionStatus = "cancelled";
    $set.cancelAtPeriodEnd = true;
  }
  if (sub.status === "attention" && tenant.subscriptionStatus === "active") {
    await markPastDue(tenant, "Your card needs attention.", `attention:${tenant.paystackSubscriptionCode}`);
  }
  if (Object.keys($set).length) await Tenant.updateOne({ _id: tenant._id }, { $set });
  return { status: sub.status };
}

/** Switch tenants whose scheduled downgrade date has arrived (when Paystack did not already). */
export async function applyScheduledPlanChange(tenant) {
  const change = tenant.pendingPlanChange;
  if (!change?.planId || !change.effectiveAt || new Date(change.effectiveAt) > new Date()) return null;
  // Give Paystack's scheduled charge time to arrive (charge.success applies the new plan itself).
  if (change.scheduledOnPaystack && addDays(change.effectiveAt, 2) > new Date()) return null;
  const plan = await getPlanById(change.planId);
  if (!plan) return null;
  // If Paystack already charged the new plan, charge.success moved the tenant onto it and cleared the change.
  await Tenant.updateOne(
    { _id: tenant._id },
    {
      $set: { subscriptionPlan: plan._id, subscriptionPlanCode: plan.code, subscriptionStatus: "expired", cancelAtPeriodEnd: false },
      $unset: { pendingPlanChange: 1 },
    },
  );
  await notify({
    tenantId: tenant._id,
    roles: ["owner", "admin"],
    type: "subscription_changed",
    severity: "warning",
    title: `Complete your switch to ${plan.name}`,
    message: `Your previous plan has ended. Confirm payment for ${plan.name} to continue recording sales.`,
    link: "/billing",
    dedupeKey: `planchange:${tenant._id}:${plan._id}`,
    email: true,
  });
  return { switched: plan.code };
}

export { getPlanByCode };
