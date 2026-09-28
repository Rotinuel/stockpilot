import mongoose from "mongoose";
import Sale from "../models/Sale.js";
import SaleItem from "../models/SaleItem.js";
import Product from "../models/Product.js";
import Customer from "../models/Customer.js";
import Tenant from "../models/Tenant.js";
import Location from "../models/Location.js";
import { byId, scoped, sessionOpts } from "./_scope.js";
import { badRequest, notFound, forbidden, ApiError } from "../lib/errors.js";
import { withTransaction, Compensation, isValidObjectId, toObjectId } from "../lib/db.js";
import { computeCartTotals, settlePayment, round2 } from "../lib/money.js";
import { hasFeature, featureMessage } from "../lib/plans.js";
import { can } from "../lib/rbac.js";
import { applyStockChange, maybeNotifyLowStock } from "./stock.js";
import { resolveLocation } from "./locations.js";
import { assertCanRecordSale } from "./limits.js";
import { nextSequence, formatNumberRef } from "./counters.js";
import { logAudit } from "./audit.js";
import { escapeRegex } from "../utils/slug.js";

/**
 * Complete a POS sale:
 *  1. save sale + line items   2. reduce inventory (+ movements)
 *  3. update customer balance  4. analytics fields (COGS, gross profit)
 * All inside a MongoDB transaction (or compensating writes without a replica set).
 * Prices always come from the database — never from the client.
 */
export async function createSale(ctx, data, request) {
  if (data.clientRequestId) {
    const dup = await Sale.findOne(scoped(ctx, { clientRequestId: data.clientRequestId })).lean();
    if (dup) return getSale(ctx, dup._id);
  }
  await assertCanRecordSale(ctx);
  const location = await resolveLocation(ctx, data.locationId);

  // Merge duplicate lines
  const qtyById = new Map();
  for (const item of data.items) qtyById.set(item.productId, (qtyById.get(item.productId) || 0) + Number(item.quantity));

  const products = await Product.find(scoped(ctx, { _id: { $in: [...qtyById.keys()] }, isDeleted: false })).lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const lines = [];
  for (const [productId, quantity] of qtyById) {
    const p = productMap.get(productId);
    if (!p) throw badRequest("One of the products in the cart no longer exists. Please refresh and try again.");
    if (p.status !== "active") throw badRequest(`"${p.name}" is inactive and cannot be sold.`);
    lines.push({ product: p, quantity, unitPrice: p.sellingPrice, costPrice: p.costPrice || 0 });
  }

  let customer = null;
  if (data.customerId) {
    customer = await Customer.findOne(byId(ctx, data.customerId, { isDeleted: false })).lean();
    if (!customer) throw badRequest("Selected customer was not found.");
  }

  const taxRate = Number(ctx.settings?.taxRate || 0);
  const totals = computeCartTotals(lines, { discountType: data.discountType, discountValue: data.discountValue, taxRate });
  const tendered = data.amountTendered === undefined ? totals.total : data.amountTendered;
  const payment = settlePayment(totals.total, tendered);

  if (payment.balance > 0) {
    if (!customer) throw badRequest("Select a customer to record a part-payment or credit sale.", { customerId: "Required for credit sales" });
    if (!hasFeature(ctx.plan, "customerBalances")) throw new ApiError(403, featureMessage("customerBalances"), "PLAN_FEATURE");
    if (customer.creditLimit > 0 && customer.balance + payment.balance > customer.creditLimit) {
      throw badRequest(`This sale would exceed ${customer.name}'s credit limit.`);
    }
  }

  const saleId = new mongoose.Types.ObjectId();
  const stockResults = [];
  // Sales recorded while offline carry the device time; accept it only within a sane window.
  let soldAt = null;
  if (data.occurredAt) {
    const t = new Date(data.occurredAt);
    const age = Date.now() - t.getTime();
    if (!Number.isNaN(t.getTime()) && age > 60_000 && age < 7 * 24 * 3600 * 1000) soldAt = t;
  }

  const sale = await withTransaction(async (session) => {
    const comp = new Compensation(!session);
    const opts = sessionOpts(session);
    stockResults.length = 0;
    try {
      const seq = await nextSequence(ctx.tenantId, "sale", session);
      const invoiceNumber = formatNumberRef(ctx.settings?.invoicePrefix || "INV", seq);

      // Reduce inventory first — fails fast on insufficient stock.
      for (const line of lines) {
        const res = await applyStockChange({
          ctx,
          product: line.product,
          locationId: location._id,
          delta: -line.quantity,
          type: "sale",
          reason: soldAt ? `Sale ${invoiceNumber} (recorded offline ${soldAt.toISOString().slice(0, 16).replace("T", " ")} UTC)` : `Sale ${invoiceNumber}`,
          referenceId: saleId,
          referenceType: "Sale",
          referenceNumber: invoiceNumber,
          unitCost: line.costPrice,
          session,
          comp,
        });
        stockResults.push(res);
      }

      const [created] = await Sale.create(
        [
          {
            _id: saleId,
            tenantId: ctx.tenantId,
            invoiceNumber,
            locationId: location._id,
            customerId: customer?._id || null,
            customerName: customer?.name || "Walk-in customer",
            itemCount: lines.reduce((s, l) => s + l.quantity, 0),
            subtotal: totals.subtotal,
            discountType: data.discountType,
            discountValue: data.discountValue || 0,
            discount: totals.discount,
            taxRate,
            tax: totals.tax,
            total: totals.total,
            amountTendered: round2(tendered),
            amountPaid: payment.amountPaid,
            balance: payment.balance,
            change: payment.change,
            paymentMethod: data.paymentMethod,
            paymentStatus: payment.paymentStatus,
            costOfGoods: totals.costOfGoods,
            grossProfit: totals.grossProfit,
            cashierId: ctx.userId,
            cashierName: ctx.userName,
            status: "completed",
            notes: data.notes,
            clientRequestId: data.clientRequestId,
            source: soldAt ? "offline" : "pos",
          },
        ],
        opts,
      );
      comp.add(() => Sale.deleteOne({ _id: saleId }));

      // Offline sales keep the time they actually happened (raw driver update: createdAt is immutable in Mongoose).
      if (soldAt) {
        await Sale.collection.updateOne({ _id: saleId }, { $set: { createdAt: soldAt, occurredAt: soldAt } }, opts);
        created.createdAt = soldAt;
      }
      const now = soldAt || created.createdAt || new Date();
      await SaleItem.insertMany(
        lines.map((l) => ({
          tenantId: ctx.tenantId,
          saleId,
          productId: l.product._id,
          locationId: location._id,
          name: l.product.name,
          sku: l.product.sku,
          unit: l.product.unit,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          costPrice: l.costPrice,
          lineTotal: round2(l.quantity * l.unitPrice),
          lineCost: round2(l.quantity * l.costPrice),
          status: "completed",
          createdAt: now,
        })),
        opts,
      );
      comp.add(() => SaleItem.deleteMany({ tenantId: ctx.tenantId, saleId }));

      if (customer) {
        const inc = { balance: payment.balance, totalPurchases: totals.total, totalPaid: payment.amountPaid, purchaseCount: 1 };
        await Customer.updateOne({ _id: customer._id, tenantId: ctx.tenantId }, { $inc: inc, $set: { lastPurchaseAt: now } }, opts);
        comp.add(() =>
          Customer.updateOne(
            { _id: customer._id },
            { $inc: Object.fromEntries(Object.entries(inc).map(([k, v]) => [k, -v])), $set: { lastPurchaseAt: customer.lastPurchaseAt || null } },
          ),
        );
      }
      return created.toObject();
    } catch (err) {
      await comp.rollback();
      throw err;
    }
  }).catch(async (err) => {
    // A concurrent duplicate submission (same clientRequestId) — return the first sale.
    if (err?.code === 11000 && data.clientRequestId) {
      const dup = await Sale.findOne(scoped(ctx, { clientRequestId: data.clientRequestId })).lean();
      if (dup) return { ...dup, __duplicate: true };
    }
    throw err;
  });

  if (sale.__duplicate) return getSale(ctx, sale._id);

  await logAudit(ctx, "sale.create", {
    entity: "Sale",
    entityId: sale._id,
    metadata: { invoiceNumber: sale.invoiceNumber, total: sale.total, items: lines.length, paymentMethod: sale.paymentMethod },
    request,
  });
  await maybeNotifyLowStock(ctx, stockResults);
  return getSale(ctx, sale._id);
}

/** Cancel a completed sale and reverse its inventory + customer balance effects. */
export async function cancelSale(ctx, id, { reason } = {}, request) {
  const sale = await Sale.findOne(byId(ctx, id)).lean();
  if (!sale) throw notFound("Sale not found.");
  if (sale.status === "cancelled") throw badRequest("This sale has already been cancelled.");
  const items = await SaleItem.find(scoped(ctx, { saleId: sale._id })).lean();

  await withTransaction(async (session) => {
    const comp = new Compensation(!session);
    const opts = sessionOpts(session);
    try {
      const updated = await Sale.findOneAndUpdate(
        { _id: sale._id, tenantId: ctx.tenantId, status: "completed" },
        { $set: { status: "cancelled", cancelledAt: new Date(), cancelledBy: ctx.userId, cancelReason: reason || "" } },
        { new: true, ...opts },
      );
      if (!updated) throw badRequest("This sale has already been cancelled.");
      comp.add(() => Sale.updateOne({ _id: sale._id }, { $set: { status: "completed" }, $unset: { cancelledAt: 1, cancelledBy: 1, cancelReason: 1 } }));

      await SaleItem.updateMany({ tenantId: ctx.tenantId, saleId: sale._id }, { $set: { status: "cancelled" } }, opts);
      comp.add(() => SaleItem.updateMany({ tenantId: ctx.tenantId, saleId: sale._id }, { $set: { status: "completed" } }));

      for (const item of items) {
        const product = await Product.findOne(scoped(ctx, { _id: item.productId }), null, opts).lean();
        if (!product) continue;
        await applyStockChange({
          ctx,
          product,
          locationId: item.locationId || sale.locationId,
          delta: item.quantity,
          type: "return",
          reason: `Sale ${sale.invoiceNumber} cancelled${reason ? `: ${reason}` : ""}`,
          referenceId: sale._id,
          referenceType: "Sale",
          referenceNumber: sale.invoiceNumber,
          unitCost: item.costPrice,
          session,
          comp,
        });
      }

      if (sale.customerId) {
        const inc = { balance: -sale.balance, totalPurchases: -sale.total, totalPaid: -sale.amountPaid, purchaseCount: -1 };
        await Customer.updateOne({ _id: sale.customerId, tenantId: ctx.tenantId }, { $inc: inc }, opts);
        comp.add(() => Customer.updateOne({ _id: sale.customerId }, { $inc: Object.fromEntries(Object.entries(inc).map(([k, v]) => [k, -v])) }));
      }
    } catch (err) {
      await comp.rollback();
      throw err;
    }
  });

  await logAudit(ctx, "sale.cancel", {
    entity: "Sale",
    entityId: sale._id,
    metadata: { invoiceNumber: sale.invoiceNumber, total: sale.total, reason },
    request,
  });
  return getSale(ctx, sale._id);
}

function saleVisibility(ctx, filter) {
  // Cashiers can only see the sales they rang up.
  if (!can(ctx.role, "sales:view_all", ctx.settings)) filter.cashierId = ctx.userId;
  return filter;
}

export async function listSales(ctx, { search, status, paymentMethod, paymentStatus, customerId, from, to, page = 1, limit = 20 } = {}) {
  const filter = saleVisibility(ctx, scoped(ctx));
  if (search) {
    const rx = { $regex: escapeRegex(search.trim()), $options: "i" };
    filter.$or = [{ invoiceNumber: rx }, { customerName: rx }];
  }
  if (status && ["completed", "cancelled"].includes(status)) filter.status = status;
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (paymentStatus && ["paid", "partial", "unpaid"].includes(paymentStatus)) filter.paymentStatus = paymentStatus;
  if (customerId && isValidObjectId(customerId)) filter.customerId = toObjectId(customerId); // cast: also used in aggregate()
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lt = to;
  }
  const [items, total, sums] = await Promise.all([
    Sale.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Sale.countDocuments(filter),
    Sale.aggregate([
      { $match: { ...filter, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$total" }, balance: { $sum: "$balance" }, count: { $sum: 1 } } },
    ]),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), summary: sums[0] || { total: 0, balance: 0, count: 0 } };
}

export async function getSale(ctx, id) {
  const sale = await Sale.findOne(byId(ctx, id)).lean();
  if (!sale) throw notFound("Sale not found.");
  if (!can(ctx.role, "sales:view_all", ctx.settings) && String(sale.cashierId) !== String(ctx.userId)) {
    throw forbidden("You can only view sales you recorded.");
  }
  const [items, customer, tenant, location] = await Promise.all([
    SaleItem.find(scoped(ctx, { saleId: sale._id })).lean(),
    sale.customerId ? Customer.findOne(scoped(ctx, { _id: sale.customerId })).select("name phone email address balance").lean() : null,
    Tenant.findById(ctx.tenantId).select("businessName address phone email logo currency settings").lean(),
    sale.locationId ? Location.findOne(scoped(ctx, { _id: sale.locationId })).select("name address phone").lean() : null,
  ]);
  return { sale, items, customer, business: tenant, location };
}
