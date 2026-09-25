import Location from "../models/Location.js";
import ProductStock from "../models/ProductStock.js";
import User from "../models/User.js";
import { byId, scoped, sessionOpts } from "./_scope.js";
import { assertCanAddLocation } from "./limits.js";
import { logAudit } from "./audit.js";
import { badRequest, notFound } from "../lib/errors.js";

export async function ensureDefaultLocation(tenantId, { name = "Main Store", address, phone } = {}, session = null) {
  const existing = await Location.findOne({ tenantId, isDefault: true }, null, sessionOpts(session)).lean();
  if (existing) return existing;
  const [loc] = await Location.create([{ tenantId, name, address, phone, isDefault: true, isActive: true }], sessionOpts(session));
  return loc.toObject();
}

export async function listLocations(ctx, { activeOnly = false } = {}) {
  const filter = scoped(ctx, activeOnly ? { isActive: true } : {});
  const locations = await Location.find(filter).sort({ isDefault: -1, name: 1 }).lean();
  const managerIds = locations.map((l) => l.managerId).filter(Boolean);
  const managers = managerIds.length ? await User.find(scoped(ctx, { _id: { $in: managerIds } })).select("name").lean() : [];
  const mgr = new Map(managers.map((m) => [String(m._id), m.name]));
  return locations.map((l) => ({ ...l, managerName: l.managerId ? mgr.get(String(l.managerId)) || null : null }));
}

/** Resolve a location for an operation: requested (must belong to tenant) or default. */
export async function resolveLocation(ctx, locationId) {
  if (locationId) {
    const loc = await Location.findOne(byId(ctx, locationId, { isActive: true })).lean();
    if (!loc) throw notFound("Location not found.");
    return loc;
  }
  if (ctx.locationId) {
    const loc = await Location.findOne(scoped(ctx, { _id: ctx.locationId })).lean();
    if (loc) return loc;
  }
  return ensureDefaultLocation(ctx.tenantId);
}

async function assertManager(ctx, managerId) {
  if (!managerId) return;
  const exists = await User.exists(scoped(ctx, { _id: managerId }));
  if (!exists) throw badRequest("Selected manager does not belong to this business.");
}

export async function createLocation(ctx, data, request) {
  await assertCanAddLocation(ctx);
  await assertManager(ctx, data.managerId);
  const loc = await Location.create({ ...data, tenantId: ctx.tenantId, isDefault: false });
  await logAudit(ctx, "location.create", { entity: "Location", entityId: loc._id, metadata: { name: loc.name }, request });
  return loc.toObject();
}

export async function updateLocation(ctx, id, data, request) {
  await assertManager(ctx, data.managerId);
  const current = await Location.findOne(byId(ctx, id)).lean();
  if (!current) throw notFound("Location not found.");
  if (current.isDefault && data.isActive === false) throw badRequest("The default location cannot be deactivated.");
  if (!current.isActive && data.isActive) await assertCanAddLocation(ctx);
  const loc = await Location.findOneAndUpdate(byId(ctx, id), { $set: data }, { new: true, runValidators: true }).lean();
  await logAudit(ctx, "location.update", { entity: "Location", entityId: loc._id, metadata: data, request });
  return loc;
}

export async function deleteLocation(ctx, id, request) {
  const loc = await Location.findOne(byId(ctx, id)).lean();
  if (!loc) throw notFound("Location not found.");
  if (loc.isDefault) throw badRequest("The default location cannot be deleted.");
  const stock = await ProductStock.exists(scoped(ctx, { locationId: loc._id, quantity: { $ne: 0 } }));
  if (stock) throw badRequest("This location still holds stock. Transfer it to another location first, or deactivate the location instead.");
  await Location.deleteOne(byId(ctx, id));
  await ProductStock.deleteMany(scoped(ctx, { locationId: loc._id }));
  await logAudit(ctx, "location.delete", { entity: "Location", entityId: loc._id, metadata: { name: loc.name }, request });
  return { ok: true };
}
