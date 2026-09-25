import Tenant from "../models/Tenant.js";
import User from "../models/User.js";
import Location from "../models/Location.js";
import { forbidden, notFound } from "../lib/errors.js";
import { logAudit } from "./audit.js";

export async function getBusiness(ctx) {
  const tenant = await Tenant.findById(ctx.tenantId).lean();
  if (!tenant) throw notFound();
  return tenant;
}

/** Update business profile/settings (subscription fields can never be set here). */
export async function updateBusiness(ctx, data, request) {
  if (data.settings?.allowCashierReports !== undefined && ctx.role !== "owner") {
    throw forbidden("Only the business owner can change staff permissions.");
  }
  const $set = {};
  for (const key of ["businessName", "email", "phone", "address", "businessType", "logo", "currency", "timezone", "country"]) {
    if (data[key] !== undefined) $set[key] = data[key];
  }
  if (data.settings) {
    for (const [k, v] of Object.entries(data.settings)) if (v !== undefined) $set[`settings.${k}`] = v;
  }
  const tenant = await Tenant.findByIdAndUpdate(ctx.tenantId, { $set }, { new: true, runValidators: true }).lean();
  if ($set.address !== undefined || $set.phone !== undefined) {
    await Location.updateOne(
      { tenantId: ctx.tenantId, isDefault: true, $or: [{ address: { $in: [null, ""] } }, { phone: { $in: [null, ""] } }] },
      { $set: { ...(data.address ? { address: data.address } : {}), ...(data.phone ? { phone: data.phone } : {}) } },
    );
  }
  await logAudit(ctx, "settings.update", { entity: "Tenant", entityId: ctx.tenantId, metadata: { fields: Object.keys($set) }, request });
  return tenant;
}

export async function saveOnboardingStep(ctx, step, data = {}, request) {
  const allowed = {};
  if (step === 1) {
    for (const k of ["businessName", "phone", "email", "address"]) if (data[k]) allowed[k] = String(data[k]).slice(0, 300);
  }
  if (step === 2 && data.businessType) allowed.businessType = String(data.businessType).slice(0, 60);
  if (step === 4) {
    if (data.currency) allowed.currency = String(data.currency).slice(0, 3).toUpperCase();
    if (data.taxRate !== undefined && data.taxRate !== "") allowed["settings.taxRate"] = Math.min(100, Math.max(0, Number(data.taxRate) || 0));
    if (data.taxLabel) allowed["settings.taxLabel"] = String(data.taxLabel).slice(0, 20);
  }
  const tenant = await Tenant.findByIdAndUpdate(
    ctx.tenantId,
    { $set: { ...allowed, "onboarding.step": Math.min(6, step + 1) } },
    { new: true, runValidators: true },
  ).lean();
  if (step === 1 && (allowed.address || allowed.phone)) {
    await Location.updateOne({ tenantId: ctx.tenantId, isDefault: true }, { $set: { ...(allowed.address ? { address: allowed.address } : {}), ...(allowed.phone ? { phone: allowed.phone } : {}) } });
  }
  return { step: tenant.onboarding.step };
}

export async function completeOnboarding(ctx, request) {
  await Tenant.updateOne({ _id: ctx.tenantId }, { $set: { "onboarding.completed": true, "onboarding.step": 6, "onboarding.completedAt": new Date() } });
  await logAudit(ctx, "onboarding.complete", { entity: "Tenant", entityId: ctx.tenantId, request });
  return { ok: true };
}

export async function updateAccount(ctx, data) {
  const $set = { name: data.name };
  if (data.phone !== undefined) $set.phone = data.phone;
  if (data.avatar !== undefined) $set.avatar = data.avatar;
  return User.findByIdAndUpdate(ctx?.userId, { $set }, { new: true }).select("name email phone avatar role").lean();
}
