import Supplier from "../models/Supplier.js";
import Purchase from "../models/Purchase.js";
import Product from "../models/Product.js";
import { byId, scoped } from "./_scope.js";
import { badRequest, notFound } from "../lib/errors.js";
import { escapeRegex } from "../utils/slug.js";
import { logAudit } from "./audit.js";
import { recordBalancePayment, listBalancePayments } from "./ledger.js";

export async function listSuppliers(ctx, { search, owing, page = 1, limit = 20 } = {}) {
  const filter = scoped(ctx, { isDeleted: false });
  if (search) {
    const rx = { $regex: escapeRegex(search.trim()), $options: "i" };
    filter.$or = [{ name: rx }, { company: rx }, { phone: rx }, { email: rx }];
  }
  if (owing === "1" || owing === true) filter.balance = { $gt: 0 };
  const [items, total, sums] = await Promise.all([
    Supplier.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Supplier.countDocuments(filter),
    Supplier.aggregate([{ $match: scoped(ctx, { isDeleted: false }) }, { $group: { _id: null, balance: { $sum: "$balance" }, purchases: { $sum: "$totalPurchases" }, count: { $sum: 1 } } }]),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), summary: sums[0] || { balance: 0, purchases: 0, count: 0 } };
}

export async function allSuppliersLite(ctx) {
  return Supplier.find(scoped(ctx, { isDeleted: false })).sort({ name: 1 }).select("name company").limit(1000).lean();
}

export async function getSupplier(ctx, id) {
  const supplier = await Supplier.findOne(byId(ctx, id, { isDeleted: false })).lean();
  if (!supplier) throw notFound("Supplier not found.");
  const [purchases, payments, productCount] = await Promise.all([
    Purchase.find(scoped(ctx, { supplierId: supplier._id })).sort({ purchaseDate: -1 }).limit(20).lean(),
    listBalancePayments(ctx, "supplier", supplier._id),
    Product.countDocuments(scoped(ctx, { supplierId: supplier._id, isDeleted: false })),
  ]);
  return { supplier, purchases, payments, productCount };
}

export async function createSupplier(ctx, data, request) {
  const supplier = await Supplier.create({ ...data, tenantId: ctx.tenantId, createdBy: ctx.userId });
  await logAudit(ctx, "supplier.create", { entity: "Supplier", entityId: supplier._id, metadata: { name: supplier.name }, request });
  return supplier.toObject();
}

export async function updateSupplier(ctx, id, data, request) {
  const { balance, totalPurchases, totalPaid, ...safe } = data;
  const supplier = await Supplier.findOneAndUpdate(byId(ctx, id, { isDeleted: false }), { $set: safe }, { new: true, runValidators: true }).lean();
  if (!supplier) throw notFound("Supplier not found.");
  await logAudit(ctx, "supplier.update", { entity: "Supplier", entityId: supplier._id, metadata: { name: supplier.name }, request });
  return supplier;
}

export async function deleteSupplier(ctx, id, request) {
  const supplier = await Supplier.findOne(byId(ctx, id, { isDeleted: false })).lean();
  if (!supplier) throw notFound("Supplier not found.");
  if (supplier.balance > 0) throw badRequest("You still owe this supplier. Record the payment before deleting.");
  await Supplier.updateOne(byId(ctx, id), { $set: { isDeleted: true } });
  await Product.updateMany(scoped(ctx, { supplierId: supplier._id }), { $set: { supplierId: null } });
  await logAudit(ctx, "supplier.delete", { entity: "Supplier", entityId: supplier._id, metadata: { name: supplier.name }, request });
  return { ok: true };
}

export async function recordSupplierPayment(ctx, id, data, request) {
  const result = await recordBalancePayment(ctx, id, data, {
    partyType: "supplier",
    PartyModel: Supplier,
    DocModel: Purchase,
    docNumberField: "referenceNumber",
    docDateField: "purchaseDate",
    partyField: "supplierId",
    refType: "Purchase",
  });
  await logAudit(ctx, "supplier.payment", { entity: "Supplier", entityId: id, metadata: { amount: data.amount, method: data.method }, request });
  return result;
}
