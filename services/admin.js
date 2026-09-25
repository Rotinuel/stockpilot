// Super Admin (platform owner) operations. Only reachable through routes that
// require role === "super_admin". These are the ONLY cross-tenant queries.
import Tenant from "../models/Tenant.js";
import User from "../models/User.js";
import Payment from "../models/Payment.js";
import Subscription from "../models/Subscription.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import AuditLog from "../models/AuditLog.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { isValidObjectId } from "../lib/db.js";
import { addDays } from "../lib/access.js";
import { round2 } from "../lib/money.js";
import { escapeRegex } from "../utils/slug.js";
import { getUsage } from "./limits.js";
import { logAudit } from "./audit.js";
import { notify } from "./notifications.js";
import { invalidatePlanCache } from "./plans.js";
import { addInterval, syncPlanToPaystack } from "./billing.js";
import { isPaystackConfigured } from "../lib/paystack.js";

const MONTHLY_FACTOR = { monthly: 1, quarterly: 1 / 3, biannually: 1 / 6, annually: 1 / 12 };

export async function platformStats(now = new Date()) {
  const d30 = addDays(now, -30);
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  const [
    totalBusinesses,
    suspended,
    trialBusinesses,
    expiredTrials,
    activeSubs,
    pastDue,
    cancelled,
    newRegistrations30,
    newToday,
    [revenue],
    [revenue30],
    failedPayments30,
    activeByPlan,
    plans,
    revenueByMonth,
    registrationsByDay,
    cancellations30,
  ] = await Promise.all([
    Tenant.countDocuments({}),
    Tenant.countDocuments({ status: "suspended" }),
    Tenant.countDocuments({ subscriptionStatus: "trialing", trialEndsAt: { $gt: now } }),
    Tenant.countDocuments({ $or: [{ subscriptionStatus: "trialing", trialEndsAt: { $lte: now } }, { subscriptionStatus: "expired", subscriptionPlanCode: "trial" }] }),
    Tenant.countDocuments({ subscriptionStatus: "active" }),
    Tenant.countDocuments({ subscriptionStatus: "past_due" }),
    Tenant.countDocuments({ subscriptionStatus: "cancelled" }),
    Tenant.countDocuments({ createdAt: { $gte: d30 } }),
    Tenant.countDocuments({ createdAt: { $gte: startOfToday } }),
    Payment.aggregate([{ $match: { status: "success" } }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { status: "success", paidAt: { $gte: d30 } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Payment.countDocuments({ status: "failed", createdAt: { $gte: d30 } }),
    Tenant.aggregate([{ $match: { subscriptionStatus: { $in: ["active", "past_due", "cancelled"] }, status: "active" } }, { $group: { _id: "$subscriptionPlan", count: { $sum: 1 } } }]),
    SubscriptionPlan.find({}).lean(),
    Payment.aggregate([
      { $match: { status: "success", paidAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$paidAt" } }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Tenant.aggregate([
      { $match: { createdAt: { $gte: d30 } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Tenant.countDocuments({ cancelledAt: { $gte: d30 } }),
  ]);

  const planMap = new Map(plans.map((p) => [String(p._id), p]));
  let mrr = 0;
  const planDistribution = [];
  for (const row of activeByPlan) {
    const plan = planMap.get(String(row._id));
    if (!plan || plan.isTrial) continue;
    mrr += plan.price * (MONTHLY_FACTOR[plan.interval] || 1) * row.count;
    planDistribution.push({ plan: plan.name, count: row.count });
  }

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const row = revenueByMonth.find((r) => r._id === key);
    months.push({ month: key, label: d.toLocaleString("en-GB", { month: "short" }), total: round2(row?.total || 0), count: row?.count || 0 });
  }
  const regMap = new Map(registrationsByDay.map((r) => [r._id, r.count]));
  const registrations = [];
  for (let i = 29; i >= 0; i--) {
    const key = addDays(startOfToday, -i).toISOString().slice(0, 10);
    registrations.push({ date: key, count: regMap.get(key) || 0 });
  }

  const payingBase = activeSubs + pastDue + cancelled + cancellations30;
  return {
    totalBusinesses,
    activeBusinesses: totalBusinesses - suspended,
    suspended,
    trialBusinesses,
    expiredTrials,
    activeSubscriptions: activeSubs,
    pastDue,
    cancelled,
    mrr: round2(mrr),
    arr: round2(mrr * 12),
    totalRevenue: round2(revenue?.total || 0),
    successfulPayments: revenue?.count || 0,
    revenue30: round2(revenue30?.total || 0),
    failedPayments30,
    newRegistrations30,
    newToday,
    cancellations30,
    churnRate: payingBase ? round2((cancellations30 / payingBase) * 100) : 0,
    planDistribution,
    revenueByMonth: months,
    registrations,
  };
}

export async function listTenants({ search, subscriptionStatus, status, planId, page = 1, limit = 20 } = {}) {
  const filter = {};
  if (search) {
    const rx = { $regex: escapeRegex(search.trim()), $options: "i" };
    filter.$or = [{ businessName: rx }, { email: rx }, { slug: rx }, { phone: rx }];
  }
  if (subscriptionStatus) filter.subscriptionStatus = subscriptionStatus;
  if (status) filter.status = status;
  if (planId && isValidObjectId(planId)) filter.subscriptionPlan = planId;
  const [items, total] = await Promise.all([
    Tenant.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Tenant.countDocuments(filter),
  ]);
  const owners = await User.find({ _id: { $in: items.map((t) => t.ownerId).filter(Boolean) } }).select("name email").lean();
  const ownerMap = new Map(owners.map((o) => [String(o._id), o]));
  return { items: items.map((t) => ({ ...t, owner: ownerMap.get(String(t.ownerId)) || null })), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getTenantDetail(id) {
  if (!isValidObjectId(String(id))) throw notFound("Business not found.");
  const tenant = await Tenant.findById(id).lean();
  if (!tenant) throw notFound("Business not found.");
  const [users, payments, subscriptions, usage, audit, plan] = await Promise.all([
    User.find({ tenantId: tenant._id }).select("name email role isActive lastLoginAt createdAt").sort({ role: 1 }).lean(),
    Payment.find({ tenantId: tenant._id }).sort({ createdAt: -1 }).limit(20).lean(),
    Subscription.find({ tenantId: tenant._id }).sort({ createdAt: -1 }).limit(20).lean(),
    getUsage(tenant._id, { timezone: tenant.timezone }),
    AuditLog.find({ tenantId: tenant._id }).sort({ timestamp: -1 }).limit(25).lean(),
    tenant.subscriptionPlan ? SubscriptionPlan.findById(tenant.subscriptionPlan).lean() : null,
  ]);
  return { tenant, users, payments, subscriptions, usage, audit, plan };
}

export async function tenantAction(admin, id, data, request) {
  if (!isValidObjectId(String(id))) throw notFound("Business not found.");
  const tenant = await Tenant.findById(id).lean();
  if (!tenant) throw notFound("Business not found.");
  const actor = { userId: admin._id, userName: admin.name, role: "super_admin" };

  switch (data.action) {
    case "suspend": {
      await Tenant.updateOne({ _id: tenant._id }, { $set: { status: "suspended", suspendedAt: new Date(), suspendedReason: data.reason || "" } });
      await User.updateMany({ tenantId: tenant._id }, { $inc: { tokenVersion: 1 } }); // sign everyone out
      await logAudit(actor, "tenant.suspend", { tenantId: tenant._id, entity: "Tenant", entityId: tenant._id, metadata: { reason: data.reason }, request });
      return { ok: true };
    }
    case "activate": {
      await Tenant.updateOne({ _id: tenant._id }, { $set: { status: "active" }, $unset: { suspendedAt: 1, suspendedReason: 1 } });
      await logAudit(actor, "tenant.activate", { tenantId: tenant._id, entity: "Tenant", entityId: tenant._id, request });
      return { ok: true };
    }
    case "extend_trial": {
      const days = data.days || 7;
      const base = tenant.trialEndsAt && new Date(tenant.trialEndsAt) > new Date() ? tenant.trialEndsAt : new Date();
      const trialEndsAt = addDays(base, days);
      await Tenant.updateOne({ _id: tenant._id }, { $set: { subscriptionStatus: "trialing", trialEndsAt, remindersSent: [] } });
      await logAudit(actor, "tenant.extend_trial", { tenantId: tenant._id, entity: "Tenant", entityId: tenant._id, metadata: { days, trialEndsAt }, request });
      await notify({ tenantId: tenant._id, roles: ["owner", "admin"], type: "system", severity: "success", title: "Your trial has been extended", message: `Your free trial now ends on ${trialEndsAt.toDateString()}.`, link: "/billing" });
      return { ok: true, trialEndsAt };
    }
    case "set_plan": {
      // Manual/complimentary activation (e.g. bank transfer received offline).
      const plan = data.planId ? await SubscriptionPlan.findById(data.planId).lean() : null;
      if (!plan) throw badRequest("Choose a plan.");
      const now = new Date();
      const end = data.periodDays ? addDays(now, data.periodDays) : addInterval(now, plan.interval);
      await Subscription.updateMany({ tenantId: tenant._id, status: { $in: ["trialing", "active", "past_due", "cancelled"] } }, { $set: { status: "expired", endedAt: now } });
      const sub = await Subscription.create({
        tenantId: tenant._id,
        planId: plan._id,
        planCode: plan.code,
        status: plan.isTrial ? "trialing" : "active",
        amount: 0,
        currency: plan.currency,
        interval: plan.interval,
        currentPeriodStart: now,
        currentPeriodEnd: end,
        changeType: "manual",
      });
      await Tenant.updateOne(
        { _id: tenant._id },
        {
          $set: plan.isTrial
            ? { subscriptionPlan: plan._id, subscriptionPlanCode: plan.code, subscriptionStatus: "trialing", trialEndsAt: end }
            : { subscriptionPlan: plan._id, subscriptionPlanCode: plan.code, subscriptionStatus: "active", subscriptionStartDate: now, subscriptionEndDate: end, nextBillingDate: end, cancelAtPeriodEnd: true },
          $unset: { pastDueSince: 1, graceEndsAt: 1, pendingPlanChange: 1 },
        },
      );
      await logAudit(actor, "subscription.manual_change", { tenantId: tenant._id, entity: "Subscription", entityId: sub._id, metadata: { plan: plan.code, until: end }, request });
      await notify({ tenantId: tenant._id, roles: ["owner", "admin"], type: "subscription_changed", severity: "success", title: `Your plan is now ${plan.name}`, message: `Active until ${end.toDateString()}.`, link: "/billing" });
      return { ok: true };
    }
    default:
      throw badRequest("Unknown action.");
  }
}

export async function listUsers({ search, role, page = 1, limit = 25 } = {}) {
  const filter = {};
  if (search) {
    const rx = { $regex: escapeRegex(search.trim()), $options: "i" };
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  if (role) filter.role = role;
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select("name email phone role tenantId isActive lastLoginAt createdAt emailVerified").lean(),
    User.countDocuments(filter),
  ]);
  const tenants = await Tenant.find({ _id: { $in: items.map((u) => u.tenantId).filter(Boolean) } }).select("businessName").lean();
  const tmap = new Map(tenants.map((t) => [String(t._id), t.businessName]));
  return { items: items.map((u) => ({ ...u, businessName: u.tenantId ? tmap.get(String(u.tenantId)) || "—" : "Platform" })), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function setUserActive(admin, id, isActive, request) {
  if (!isValidObjectId(String(id))) throw notFound();
  if (String(admin._id) === String(id)) throw badRequest("You cannot deactivate your own account.");
  const user = await User.findByIdAndUpdate(id, { $set: { isActive }, ...(isActive ? {} : { $inc: { tokenVersion: 1 } }) }, { new: true }).select("name email isActive tenantId").lean();
  if (!user) throw notFound();
  await logAudit({ userId: admin._id, userName: admin.name, role: "super_admin" }, isActive ? "user.activate" : "user.deactivate", { tenantId: user.tenantId, entity: "User", entityId: user._id, metadata: { email: user.email }, request });
  return user;
}

export async function listPayments({ status, search, page = 1, limit = 25 } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (search) filter.reference = { $regex: escapeRegex(search.trim()), $options: "i" };
  const [items, total, sums] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Payment.countDocuments(filter),
    Payment.aggregate([{ $group: { _id: "$status", total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
  ]);
  const tenants = await Tenant.find({ _id: { $in: items.map((p) => p.tenantId) } }).select("businessName").lean();
  const tmap = new Map(tenants.map((t) => [String(t._id), t.businessName]));
  return { items: items.map((p) => ({ ...p, businessName: tmap.get(String(p.tenantId)) || "—" })), total, page, pages: Math.max(1, Math.ceil(total / limit)), byStatus: sums };
}

export async function listSubscriptions({ status, page = 1, limit = 25 } = {}) {
  const filter = {};
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    Subscription.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Subscription.countDocuments(filter),
  ]);
  const [tenants, plans] = await Promise.all([
    Tenant.find({ _id: { $in: items.map((s) => s.tenantId) } }).select("businessName").lean(),
    SubscriptionPlan.find({ _id: { $in: items.map((s) => s.planId) } }).select("name").lean(),
  ]);
  const tmap = new Map(tenants.map((t) => [String(t._id), t.businessName]));
  const pmap = new Map(plans.map((p) => [String(p._id), p.name]));
  return {
    items: items.map((s) => ({ ...s, businessName: tmap.get(String(s.tenantId)) || "—", planName: pmap.get(String(s.planId)) || s.planCode })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

// ── Plans ───────────────────────────────────────────────────
export async function listPlansWithCounts() {
  const [plans, counts] = await Promise.all([
    SubscriptionPlan.find({}).sort({ sortOrder: 1, price: 1 }).lean(),
    Tenant.aggregate([{ $group: { _id: "$subscriptionPlan", count: { $sum: 1 } } }]),
  ]);
  const cmap = new Map(counts.map((c) => [String(c._id), c.count]));
  return plans.map((p) => ({ ...p, tenantCount: cmap.get(String(p._id)) || 0 }));
}

export async function createPlan(admin, data, request) {
  if (await SubscriptionPlan.exists({ code: data.code })) throw conflict("A plan with this code already exists.", { code: "Already exists" });
  if (data.isTrial && (await SubscriptionPlan.exists({ isTrial: true }))) throw badRequest("A trial plan already exists.");
  const plan = await SubscriptionPlan.create(data);
  invalidatePlanCache();
  await logAudit({ userId: admin._id, userName: admin.name, role: "super_admin" }, "plan.create", { tenantId: null, entity: "SubscriptionPlan", entityId: plan._id, metadata: { code: plan.code, price: plan.price }, request });
  return plan.toObject();
}

export async function updatePlan(admin, id, data, request) {
  if (!isValidObjectId(String(id))) throw notFound("Plan not found.");
  const current = await SubscriptionPlan.findById(id).lean();
  if (!current) throw notFound("Plan not found.");
  const { code, ...rest } = data; // plan codes are immutable (referenced by tenants)
  const plan = await SubscriptionPlan.findByIdAndUpdate(id, { $set: rest }, { new: true, runValidators: true }).lean();
  invalidatePlanCache();

  let paystackSync = null;
  const billingChanged = current.price !== plan.price || current.interval !== plan.interval || current.name !== plan.name;
  if (billingChanged && !plan.isTrial && plan.price > 0 && isPaystackConfigured()) {
    try {
      paystackSync = await syncPlanToPaystack(plan._id);
    } catch (err) {
      paystackSync = { error: err?.message };
    }
  }
  await logAudit({ userId: admin._id, userName: admin.name, role: "super_admin" }, "plan.update", {
    tenantId: null,
    entity: "SubscriptionPlan",
    entityId: plan._id,
    metadata: { code: plan.code, priceFrom: current.price, priceTo: plan.price },
    request,
  });
  return { plan, paystackSync };
}

export async function deactivatePlan(admin, id, request) {
  if (!isValidObjectId(String(id))) throw notFound("Plan not found.");
  const plan = await SubscriptionPlan.findById(id).lean();
  if (!plan) throw notFound("Plan not found.");
  if (plan.isTrial) throw badRequest("The trial plan cannot be removed.");
  const inUse = await Tenant.countDocuments({ subscriptionPlan: plan._id });
  if (inUse) {
    await SubscriptionPlan.updateOne({ _id: plan._id }, { $set: { isActive: false, isPublic: false } });
    invalidatePlanCache();
    await logAudit({ userId: admin._id, userName: admin.name, role: "super_admin" }, "plan.deactivate", { tenantId: null, entity: "SubscriptionPlan", entityId: plan._id, request });
    return { deactivated: true, message: `${inUse} business(es) use this plan, so it was hidden and deactivated instead of deleted.` };
  }
  await SubscriptionPlan.deleteOne({ _id: plan._id });
  invalidatePlanCache();
  await logAudit({ userId: admin._id, userName: admin.name, role: "super_admin" }, "plan.delete", { tenantId: null, entity: "SubscriptionPlan", entityId: plan._id, request });
  return { deleted: true };
}

export async function listPlatformAudit({ action, tenantId, page = 1, limit = 30 } = {}) {
  const filter = {};
  if (action) filter.action = { $regex: `^${escapeRegex(action)}` };
  if (tenantId && isValidObjectId(tenantId)) filter.tenantId = tenantId;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  const tenants = await Tenant.find({ _id: { $in: items.map((a) => a.tenantId).filter(Boolean) } }).select("businessName").lean();
  const tmap = new Map(tenants.map((t) => [String(t._id), t.businessName]));
  return { items: items.map((a) => ({ ...a, businessName: a.tenantId ? tmap.get(String(a.tenantId)) || "—" : "Platform" })), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}
