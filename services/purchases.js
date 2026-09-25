import mongoose from "mongoose";
import Purchase from "../models/Purchase.js";
import PurchaseItem from "../models/PurchaseItem.js";
import Product from "../models/Product.js";
import Supplier from "../models/Supplier.js";
import Location from "../models/Location.js";
import { byId, scoped, sessionOpts } from "./_scope.js";
import { badRequest, notFound, ApiError } from "../lib/errors.js";
import { withTransaction, Compensation, isValidObjectId, toObjectId } from "../lib/db.js";
import { round2, settlePayment } from "../lib/money.js";
import { hasFeature, featureMessage } from "../lib/plans.js";
import { applyStockChange } from "./stock.js";
import { resolveLocation } from "./locations.js";
import { nextSequence, formatNumberRef } from "./counters.js";
import { logAudit } from "./audit.js";
import { escapeRegex } from "../utils/slug.js";

/**
 * Record a stock purchase: increases inventory (with movements), optionally
 * updates product cost/selling prices, and updates the supplier balance.
 */
export async function createPurchase(ctx, data, request) {
  const location = await resolveLocation(ctx, data.locationId);
  let supplier = null;
  if (data.supplierId) {
    supplier = await Supplier.findOne(byId(ctx, data.supplierId, { isDeleted: false })).lean();
    if (!supplier) throw badRequest("Selected supplier was not found.");
  }

  const merged = new Map();
  for (const item of data.items) {
    const prev = merged.get(item.productId);
    if (prev) {
      const qty = prev.quantity + Number(item.quantity);
      prev.unitCost = round2((prev.unitCost * prev.quantity + Number(item.unitCost) * Number(item.quantity)) / qty);
      prev.quantity = qty;
      if (item.sellingPrice !== undefined) prev.sellingPrice = item.sellingPrice;
    } else merged.set(item.productId, { ...item, quantity: Number(item.quantity), unitCost: Number(item.unitCost) });
  }

  const products = await Product.find(scoped(ctx, { _id: { $in: [...merged.keys()] }, isDeleted: false })).lean();
  const pmap = new Map(products.map((p) => [String(p._id), p]));
  const lines = [...merged.values()].map((i) => {
    const p = pmap.get(i.productId);
    if (!p) throw badRequest("One of the selected products no longer exists.");
    return { product: p, quantity: i.quantity, unitCost: round2(i.unitCost), sellingPrice: i.sellingPrice, lineTotal: round2(i.quantity * i.unitCost) };
  });

  const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const total = round2(subtotal + Number(data.otherCharges || 0));
  const pay = settlePayment(total, data.amountPaid);
  if (pay.balance > 0) {
    if (!supplier) throw badRequest("Select a supplier to record an unpaid or part-paid purchase.", { supplierId: "Required when there is a balance" });
    if (!hasFeature(ctx.plan, "supplierBalances")) throw new ApiError(403, featureMessage("supplierBalances"), "PLAN_FEATURE");
  }

  const purchaseId = new mongoose.Types.ObjectId();
  const purchase = await withTransaction(async (session) => {
    const comp = new Compensation(!session);
    const opts = sessionOpts(session);
    try {
      const seq = await nextSequence(ctx.tenantId, "purchase", session);
      const referenceNumber = formatNumberRef(ctx.settings?.purchasePrefix || "PO", seq);

      for (const line of lines) {
        await applyStockChange({
          ctx,
          product: line.product,
          locationId: location._id,
          delta: line.quantity,
          type: "purchase",
          reason: `Purchase ${referenceNumber}${supplier ? ` from ${supplier.name}` : ""}`,
          referenceId: purchaseId,
          referenceType: "Purchase",
          referenceNumber,
          unitCost: line.unitCost,
          session,
          comp,
        });
        const $set = {};
        if (data.updateCostPrice !== false) $set.costPrice = line.unitCost;
        if (line.sellingPrice !== undefined && line.sellingPrice > 0) $set.sellingPrice = round2(line.sellingPrice);
        if (supplier && !line.product.supplierId) $set.supplierId = supplier._id;
        if (Object.keys($set).length) {
          await Product.updateOne({ _id: line.product._id, tenantId: ctx.tenantId }, { $set }, opts);
          const old = { costPrice: line.product.costPrice, sellingPrice: line.product.sellingPrice, supplierId: line.product.supplierId || null };
          comp.add(() => Product.updateOne({ _id: line.product._id }, { $set: old }));
        }
      }

      const purchaseDate = data.purchaseDate || new Date();
      const [created] = await Purchase.create(
        [
          {
            _id: purchaseId,
            tenantId: ctx.tenantId,
            referenceNumber,
            invoiceNumber: data.invoiceNumber,
            locationId: location._id,
            supplierId: supplier?._id || null,
            supplierName: supplier?.name || "Unspecified supplier",
            itemCount: lines.reduce((s, l) => s + l.quantity, 0),
            subtotal,
            otherCharges: round2(data.otherCharges || 0),
            total,
            amountPaid: pay.amountPaid,
            balance: pay.balance,
            paymentStatus: pay.paymentStatus,
            paymentMethod: data.paymentMethod,
            purchaseDate,
            notes: data.notes,
            status: "completed",
            createdBy: ctx.userId,
            createdByName: ctx.userName,
          },
        ],
        opts,
      );
      comp.add(() => Purchase.deleteOne({ _id: purchaseId }));

      await PurchaseItem.insertMany(
        lines.map((l) => ({
          tenantId: ctx.tenantId,
          purchaseId,
          productId: l.product._id,
          name: l.product.name,
          sku: l.product.sku,
          unit: l.product.unit,
          quantity: l.quantity,
          unitCost: l.unitCost,
          lineTotal: l.lineTotal,
          createdAt: purchaseDate,
        })),
        opts,
      );
      comp.add(() => PurchaseItem.deleteMany({ tenantId: ctx.tenantId, purchaseId }));

      if (supplier) {
        const inc = { balance: pay.balance, totalPurchases: total, totalPaid: pay.amountPaid, purchaseCount: 1 };
        await Supplier.updateOne({ _id: supplier._id, tenantId: ctx.tenantId }, { $inc: inc, $set: { lastPurchaseAt: purchaseDate } }, opts);
        comp.add(() => Supplier.updateOne({ _id: supplier._id }, { $inc: Object.fromEntries(Object.entries(inc).map(([k, v]) => [k, -v])) }));
      }
      return created.toObject();
    } catch (err) {
      await comp.rollback();
      throw err;
    }
  });

  await logAudit(ctx, "purchase.create", {
    entity: "Purchase",
    entityId: purchase._id,
    metadata: { referenceNumber: purchase.referenceNumber, total: purchase.total, supplier: purchase.supplierName, items: lines.length },
    request,
  });
  return getPurchase(ctx, purchase._id);
}

/** Reverse a purchase (only possible while the received stock is still on hand). */
export async function cancelPurchase(ctx, id, request) {
  const purchase = await Purchase.findOne(byId(ctx, id)).lean();
  if (!purchase) throw notFound("Purchase not found.");
  if (purchase.status === "cancelled") throw badRequest("This purchase has already been cancelled.");
  const items = await PurchaseItem.find(scoped(ctx, { purchaseId: purchase._id })).lean();

  await withTransaction(async (session) => {
    const comp = new Compensation(!session);
    const opts = sessionOpts(session);
    try {
      const updated = await Purchase.findOneAndUpdate(
        { _id: purchase._id, tenantId: ctx.tenantId, status: "completed" },
        { $set: { status: "cancelled", cancelledAt: new Date(), cancelledBy: ctx.userId } },
        { new: true, ...opts },
      );
      if (!updated) throw badRequest("This purchase has already been cancelled.");
      comp.add(() => Purchase.updateOne({ _id: purchase._id }, { $set: { status: "completed" } }));

      for (const item of items) {
        const product = await Product.findOne(scoped(ctx, { _id: item.productId }), null, opts).lean();
        if (!product) continue;
        await applyStockChange({
          ctx,
          product,
          locationId: purchase.locationId,
          delta: -item.quantity,
          type: "adjustment",
          reason: `Purchase ${purchase.referenceNumber} cancelled`,
          referenceId: purchase._id,
          referenceType: "Purchase",
          referenceNumber: purchase.referenceNumber,
          session,
          comp,
        });
      }
      if (purchase.supplierId) {
        const inc = { balance: -purchase.balance, totalPurchases: -purchase.total, totalPaid: -purchase.amountPaid, purchaseCount: -1 };
        await Supplier.updateOne({ _id: purchase.supplierId, tenantId: ctx.tenantId }, { $inc: inc }, opts);
        comp.add(() => Supplier.updateOne({ _id: purchase.supplierId }, { $inc: Object.fromEntries(Object.entries(inc).map(([k, v]) => [k, -v])) }));
      }
    } catch (err) {
      await comp.rollback();
      throw err;
    }
  });

  await logAudit(ctx, "purchase.cancel", { entity: "Purchase", entityId: purchase._id, metadata: { referenceNumber: purchase.referenceNumber, total: purchase.total }, request });
  return getPurchase(ctx, purchase._id);
}

export async function listPurchases(ctx, { search, supplierId, paymentStatus, status, from, to, page = 1, limit = 20 } = {}) {
  const filter = scoped(ctx);
  if (search) {
    const rx = { $regex: escapeRegex(search.trim()), $options: "i" };
    filter.$or = [{ referenceNumber: rx }, { invoiceNumber: rx }, { supplierName: rx }];
  }
  if (supplierId && isValidObjectId(supplierId)) filter.supplierId = toObjectId(supplierId); // cast: also used in aggregate()
  if (paymentStatus && ["paid", "partial", "unpaid"].includes(paymentStatus)) filter.paymentStatus = paymentStatus;
  if (status && ["completed", "cancelled"].includes(status)) filter.status = status;
  if (from || to) {
    filter.purchaseDate = {};
    if (from) filter.purchaseDate.$gte = from;
    if (to) filter.purchaseDate.$lt = to;
  }
  const [items, total, sums] = await Promise.all([
    Purchase.find(filter).sort({ purchaseDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Purchase.countDocuments(filter),
    Purchase.aggregate([{ $match: { ...filter, status: "completed" } }, { $group: { _id: null, total: { $sum: "$total" }, balance: { $sum: "$balance" } } }]),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), summary: sums[0] || { total: 0, balance: 0 } };
}

export async function getPurchase(ctx, id) {
  const purchase = await Purchase.findOne(byId(ctx, id)).lean();
  if (!purchase) throw notFound("Purchase not found.");
  const [items, supplier, location] = await Promise.all([
    PurchaseItem.find(scoped(ctx, { purchaseId: purchase._id })).lean(),
    purchase.supplierId ? Supplier.findOne(scoped(ctx, { _id: purchase.supplierId })).select("name company phone email balance").lean() : null,
    purchase.locationId ? Location.findOne(scoped(ctx, { _id: purchase.locationId })).select("name").lean() : null,
  ]);
  return { purchase, items, supplier, location };
}
