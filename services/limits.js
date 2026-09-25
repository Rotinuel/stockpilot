// Server-side plan limit enforcement. Called BEFORE creating limited resources.
import Product from "../models/Product.js";
import User from "../models/User.js";
import Invitation from "../models/Invitation.js";
import Location from "../models/Location.js";
import Sale from "../models/Sale.js";
import { isUnlimited, limitMessage, withinLimit } from "../lib/plans.js";
import { planLimit } from "../lib/errors.js";
import { resolveRange } from "../utils/dates.js";

export async function getUsage(tenantId, { timezone } = {}) {
  const month = resolveRange("this_month", { tz: timezone });
  const [products, staffUsers, pendingInvites, locations, monthlyTransactions] = await Promise.all([
    Product.countDocuments({ tenantId, isDeleted: false }),
    User.countDocuments({ tenantId, role: { $ne: "owner" }, isActive: true }),
    Invitation.countDocuments({ tenantId, status: "pending", expiresAt: { $gt: new Date() } }),
    Location.countDocuments({ tenantId, isActive: true }),
    Sale.countDocuments({ tenantId, createdAt: { $gte: month.from, $lt: month.to } }),
  ]);
  return { products, staffUsers: staffUsers + pendingInvites, activeStaff: staffUsers, pendingInvites, locations, monthlyTransactions };
}

async function assertLimit(ctx, resource, countFn, adding = 1) {
  const limit = ctx.plan?.limits?.[resource];
  if (isUnlimited(limit)) return;
  const current = await countFn();
  if (!withinLimit(current, limit, adding)) {
    throw planLimit(limitMessage(resource, limit), { resource, limit, current });
  }
}

export function assertCanAddProducts(ctx, adding = 1) {
  return assertLimit(ctx, "products", () => Product.countDocuments({ tenantId: ctx.tenantId, isDeleted: false }), adding);
}

export function assertCanAddStaff(ctx) {
  return assertLimit(ctx, "staffUsers", async () => {
    const [users, invites] = await Promise.all([
      User.countDocuments({ tenantId: ctx.tenantId, role: { $ne: "owner" }, isActive: true }),
      Invitation.countDocuments({ tenantId: ctx.tenantId, status: "pending", expiresAt: { $gt: new Date() } }),
    ]);
    return users + invites;
  });
}

export function assertCanAddLocation(ctx) {
  return assertLimit(ctx, "locations", () => Location.countDocuments({ tenantId: ctx.tenantId, isActive: true }));
}

export function assertCanRecordSale(ctx) {
  return assertLimit(ctx, "monthlyTransactions", () => {
    const month = resolveRange("this_month", { tz: ctx.timezone });
    return Sale.countDocuments({ tenantId: ctx.tenantId, createdAt: { $gte: month.from, $lt: month.to } });
  });
}
