// Inventory engine. ALL stock changes go through applyStockChange(), which
// atomically updates per-location stock + the product total and writes an
// InventoryMovement. Stock is never modified silently.
import Product from "../models/Product.js";
import ProductStock from "../models/ProductStock.js";
import InventoryMovement from "../models/InventoryMovement.js";
import Location from "../models/Location.js";
import { byId, scoped, sessionOpts } from "./_scope.js";
import { badRequest, notFound } from "../lib/errors.js";
import { withTransaction, Compensation } from "../lib/db.js";
import { resolveLocation } from "./locations.js";
import { logAudit } from "./audit.js";
import { notify } from "./notifications.js";
import { hasFeature } from "../lib/plans.js";
import { escapeRegex } from "../utils/slug.js";
import { round2 } from "../lib/money.js";

const round3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;

/**
 * @param {object} p
 * @param {object} p.ctx tenant context
 * @param {object|string} p.product product doc (lean) or id
 * @param {string|object} p.locationId
 * @param {number} p.delta signed quantity change
 * @param {string} p.type movement type
 * @param {boolean} [p.affectsTotal=true] false for transfers between locations
 * @param {import('mongoose').ClientSession|null} [p.session]
 * @param {Compensation} [p.comp]
 */
export async function applyStockChange({
  ctx,
  product,
  locationId,
  delta,
  type,
  reason,
  referenceId,
  referenceType = null,
  referenceNumber,
  unitCost,
  session = null,
  comp,
  affectsTotal = true,
  allowNegative = false,
}) {
  delta = round3(delta);
  if (!Number.isFinite(delta)) throw badRequest("Invalid quantity.");
  const opts = sessionOpts(session);

  const prod =
    typeof product === "object" && product?._id
      ? product
      : await Product.findOne(byId(ctx, product, { isDeleted: false }), null, opts).lean();
  if (!prod || String(prod.tenantId) !== String(ctx.tenantId)) throw notFound("Product not found.");

  // 1) Per-location stock (conditional decrement prevents negative stock / race conditions)
  let stock;
  if (delta < 0 && !allowNegative) {
    stock = await ProductStock.findOneAndUpdate(
      { tenantId: ctx.tenantId, productId: prod._id, locationId, quantity: { $gte: -delta } },
      { $inc: { quantity: delta } },
      { new: true, ...opts },
    ).lean();
    if (!stock) {
      const current = await ProductStock.findOne({ tenantId: ctx.tenantId, productId: prod._id, locationId }, null, opts).lean();
      const available = current?.quantity || 0;
      throw badRequest(`Not enough stock for "${prod.name}". Available: ${available} ${prod.unit || ""}`.trim(), {
        productId: String(prod._id),
        available,
      });
    }
  } else {
    stock = await ProductStock.findOneAndUpdate(
      { tenantId: ctx.tenantId, productId: prod._id, locationId },
      { $inc: { quantity: delta } }, // filter equality fields are copied on upsert
      { new: true, upsert: true, ...opts },
    ).lean();
  }
  comp?.add(() => ProductStock.updateOne({ _id: stock._id }, { $inc: { quantity: -delta } }));

  // 2) Product total
  let updatedProduct = prod;
  if (affectsTotal && delta !== 0) {
    updatedProduct = await Product.findOneAndUpdate({ _id: prod._id, tenantId: ctx.tenantId }, { $inc: { quantity: delta } }, { new: true, ...opts }).lean();
    comp?.add(() => Product.updateOne({ _id: prod._id }, { $inc: { quantity: -delta } }));
  } else if (!affectsTotal) {
    updatedProduct = await Product.findOne({ _id: prod._id, tenantId: ctx.tenantId }, null, opts).lean();
  }
  const newQuantity = round3(updatedProduct.quantity);
  const previousQuantity = affectsTotal ? round3(newQuantity - delta) : newQuantity;

  // 3) Ledger entry
  const [movement] = await InventoryMovement.create(
    [
      {
        tenantId: ctx.tenantId,
        productId: prod._id,
        productName: prod.name,
        locationId,
        type,
        quantity: delta,
        previousQuantity,
        newQuantity,
        locationPreviousQuantity: round3(stock.quantity - delta),
        locationNewQuantity: round3(stock.quantity),
        unitCost: unitCost !== undefined ? round2(unitCost) : prod.costPrice,
        reason,
        referenceId,
        referenceType,
        referenceNumber,
        performedBy: ctx.userId,
        performedByName: ctx.userName,
      },
    ],
    opts,
  );
  comp?.add(() => InventoryMovement.deleteOne({ _id: movement._id }));

  return { product: updatedProduct, previousQuantity, newQuantity, movement };
}

/** Low-stock notification when a product crosses its minimum level. */
export async function maybeNotifyLowStock(ctx, changes) {
  if (!hasFeature(ctx.plan, "lowStockAlerts") || ctx.settings?.lowStockNotifications === false) return;
  for (const { product, previousQuantity, newQuantity } of changes) {
    if (!product) continue;
    const min = Number(product.minimumStockLevel || 0);
    if (previousQuantity > min && newQuantity <= min) {
      const day = new Date().toISOString().slice(0, 10);
      await notify({
        tenantId: ctx.tenantId,
        type: "low_stock",
        severity: newQuantity <= 0 ? "danger" : "warning",
        roles: ["owner", "admin", "manager", "inventory_staff"],
        title: newQuantity <= 0 ? `${product.name} is out of stock` : `${product.name} is running low`,
        message: `Only ${newQuantity} ${product.unit || "units"} left (minimum ${min}).`,
        link: `/products/${product._id}`,
        dedupeKey: `low:${product._id}:${day}`,
      });
    }
  }
}

const ACTIONS = {
  add: { type: "adjustment", sign: 1, label: "Stock added" },
  remove: { type: "adjustment", sign: -1, label: "Stock removed" },
  damage: { type: "damage", sign: -1, label: "Damaged / expired stock" },
  return: { type: "return", sign: 1, label: "Customer return" },
  set: { type: "adjustment", sign: 0, label: "Stock count correction" },
};

export async function adjustStock(ctx, data, request) {
  const action = ACTIONS[data.action];
  if (!action) throw badRequest("Unknown stock action.");
  const location = await resolveLocation(ctx, data.locationId);
  const product = await Product.findOne(byId(ctx, data.productId, { isDeleted: false })).lean();
  if (!product) throw notFound("Product not found.");

  let delta;
  if (data.action === "set") {
    const current = await ProductStock.findOne(scoped(ctx, { productId: product._id, locationId: location._id })).lean();
    delta = round3(Number(data.quantity) - (current?.quantity || 0));
    if (delta === 0) throw badRequest("The counted quantity matches the current stock — nothing to change.");
  } else {
    if (!(Number(data.quantity) > 0)) throw badRequest("Quantity must be greater than zero.");
    delta = action.sign * Number(data.quantity);
  }

  const result = await withTransaction(async (session) => {
    const comp = new Compensation(!session);
    try {
      return await applyStockChange({
        ctx,
        product,
        locationId: location._id,
        delta,
        type: action.type,
        reason: data.reason || action.label,
        referenceType: "Adjustment",
        unitCost: data.unitCost,
        session,
        comp,
      });
    } catch (err) {
      await comp.rollback();
      throw err;
    }
  });

  await logAudit(ctx, "inventory.adjust", {
    entity: "Product",
    entityId: product._id,
    metadata: { action: data.action, delta, reason: data.reason, location: location.name, newQuantity: result.newQuantity },
    request,
  });
  await maybeNotifyLowStock(ctx, [result]);
  return { productId: String(product._id), previousQuantity: result.previousQuantity, newQuantity: result.newQuantity, movementId: String(result.movement._id) };
}

export async function transferStock(ctx, data, request) {
  const [from, to] = await Promise.all([
    Location.findOne(byId(ctx, data.fromLocationId, { isActive: true })).lean(),
    Location.findOne(byId(ctx, data.toLocationId, { isActive: true })).lean(),
  ]);
  if (!from || !to) throw notFound("Location not found.");
  const product = await Product.findOne(byId(ctx, data.productId, { isDeleted: false })).lean();
  if (!product) throw notFound("Product not found.");
  const qty = Number(data.quantity);

  await withTransaction(async (session) => {
    const comp = new Compensation(!session);
    try {
      const reason = data.reason || `Transfer ${from.name} → ${to.name}`;
      await applyStockChange({ ctx, product, locationId: from._id, delta: -qty, type: "transfer", reason, referenceType: "Transfer", session, comp, affectsTotal: false });
      await applyStockChange({ ctx, product, locationId: to._id, delta: qty, type: "transfer", reason, referenceType: "Transfer", session, comp, affectsTotal: false });
    } catch (err) {
      await comp.rollback();
      throw err;
    }
  });

  await logAudit(ctx, "inventory.transfer", {
    entity: "Product",
    entityId: product._id,
    metadata: { quantity: qty, from: from.name, to: to.name },
    request,
  });
  return { ok: true };
}

export async function listMovements(ctx, { productId, type, search, from, to, page = 1, limit = 20 } = {}) {
  const filter = scoped(ctx);
  if (productId) filter.productId = productId;
  if (type) filter.type = type;
  if (search) filter.productName = { $regex: escapeRegex(search), $options: "i" };
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lt = to;
  }
  const [items, total] = await Promise.all([
    InventoryMovement.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    InventoryMovement.countDocuments(filter),
  ]);
  const locIds = [...new Set(items.map((i) => String(i.locationId)).filter(Boolean))];
  const locs = locIds.length ? await Location.find(scoped(ctx, { _id: { $in: locIds } })).select("name").lean() : [];
  const locMap = new Map(locs.map((l) => [String(l._id), l.name]));
  return {
    items: items.map((i) => ({ ...i, locationName: locMap.get(String(i.locationId)) || "" })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export function lowStockFilter(ctx) {
  return scoped(ctx, { isDeleted: false, status: "active", $expr: { $lte: ["$quantity", "$minimumStockLevel"] } });
}

export async function countLowStock(ctx) {
  return Product.countDocuments(lowStockFilter(ctx));
}

export async function listLowStock(ctx, { page = 1, limit = 20, search } = {}) {
  const filter = lowStockFilter(ctx);
  if (search) filter.name = { $regex: escapeRegex(search), $options: "i" };
  const [items, total, outOfStock] = await Promise.all([
    Product.find(filter).sort({ quantity: 1, name: 1 }).skip((page - 1) * limit).limit(limit).select("-image").lean(),
    Product.countDocuments(filter),
    Product.countDocuments(scoped(ctx, { isDeleted: false, status: "active", quantity: { $lte: 0 } })),
  ]);
  return { items, total, outOfStock, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function stockByLocation(ctx, productId) {
  const rows = await ProductStock.find(scoped(ctx, { productId })).lean();
  const locs = await Location.find(scoped(ctx)).select("name isDefault isActive").lean();
  const byLoc = new Map(rows.map((r) => [String(r.locationId), r.quantity]));
  return locs.map((l) => ({ locationId: String(l._id), name: l.name, isDefault: l.isDefault, isActive: l.isActive, quantity: byLoc.get(String(l._id)) || 0 }));
}
