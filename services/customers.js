import Customer from "../models/Customer.js";
import Sale from "../models/Sale.js";
import { byId, scoped } from "./_scope.js";
import { badRequest, notFound } from "../lib/errors.js";
import { escapeRegex } from "../utils/slug.js";
import { logAudit } from "./audit.js";
import { recordBalancePayment, listBalancePayments } from "./ledger.js";

const SORTS = { name: { name: 1 }, newest: { createdAt: -1 }, balance: { balance: -1 }, purchases: { totalPurchases: -1 }, recent: { lastPurchaseAt: -1 } };

export async function listCustomers(ctx, { search, type, owing, sort = "name", page = 1, limit = 20 } = {}) {
  const filter = scoped(ctx, { isDeleted: false });
  if (search) {
    const rx = { $regex: escapeRegex(search.trim()), $options: "i" };
    filter.$or = [{ name: rx }, { phone: rx }, { email: rx }];
  }
  if (type && ["cash", "credit"].includes(type)) filter.type = type;
  if (owing === "1" || owing === true) filter.balance = { $gt: 0 };
  const [items, total, sums] = await Promise.all([
    Customer.find(filter).sort(SORTS[sort] || SORTS.name).skip((page - 1) * limit).limit(limit).lean(),
    Customer.countDocuments(filter),
    Customer.aggregate([{ $match: scoped(ctx, { isDeleted: false }) }, { $group: { _id: null, balance: { $sum: "$balance" }, purchases: { $sum: "$totalPurchases" }, count: { $sum: 1 } } }]),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), summary: sums[0] || { balance: 0, purchases: 0, count: 0 } };
}

export async function searchCustomers(ctx, q, limit = 8) {
  const filter = scoped(ctx, { isDeleted: false });
  if (q) {
    const rx = { $regex: escapeRegex(q.trim()), $options: "i" };
    filter.$or = [{ name: rx }, { phone: rx }];
  }
  return Customer.find(filter).sort({ lastPurchaseAt: -1, name: 1 }).limit(limit).select("name phone type balance creditLimit").lean();
}

export async function getCustomer(ctx, id) {
  const customer = await Customer.findOne(byId(ctx, id, { isDeleted: false })).lean();
  if (!customer) throw notFound("Customer not found.");
  const [recentSales, openSales, payments] = await Promise.all([
    Sale.find(scoped(ctx, { customerId: customer._id })).sort({ createdAt: -1 }).limit(20).lean(),
    Sale.find(scoped(ctx, { customerId: customer._id, status: "completed", balance: { $gt: 0 } })).sort({ createdAt: 1 }).lean(),
    listBalancePayments(ctx, "customer", customer._id),
  ]);
  return { customer, recentSales, openSales, payments };
}

export async function createCustomer(ctx, data, request) {
  const customer = await Customer.create({ ...data, tenantId: ctx.tenantId, createdBy: ctx.userId });
  await logAudit(ctx, "customer.create", { entity: "Customer", entityId: customer._id, metadata: { name: customer.name }, request });
  return customer.toObject();
}

export async function updateCustomer(ctx, id, data, request) {
  const { balance, totalPurchases, totalPaid, ...safe } = data; // balances only change via sales/payments
  const customer = await Customer.findOneAndUpdate(byId(ctx, id, { isDeleted: false }), { $set: safe }, { new: true, runValidators: true }).lean();
  if (!customer) throw notFound("Customer not found.");
  await logAudit(ctx, "customer.update", { entity: "Customer", entityId: customer._id, metadata: { name: customer.name }, request });
  return customer;
}

export async function deleteCustomer(ctx, id, request) {
  const customer = await Customer.findOne(byId(ctx, id, { isDeleted: false })).lean();
  if (!customer) throw notFound("Customer not found.");
  if (customer.balance > 0) throw badRequest("This customer still owes a balance. Record their payment before deleting.");
  await Customer.updateOne(byId(ctx, id), { $set: { isDeleted: true } });
  await logAudit(ctx, "customer.delete", { entity: "Customer", entityId: customer._id, metadata: { name: customer.name }, request });
  return { ok: true };
}

export async function recordCustomerPayment(ctx, id, data, request) {
  const result = await recordBalancePayment(ctx, id, data, {
    partyType: "customer",
    PartyModel: Customer,
    DocModel: Sale,
    docNumberField: "invoiceNumber",
    docDateField: "createdAt",
    partyField: "customerId",
    refType: "Sale",
  });
  await logAudit(ctx, "customer.payment", { entity: "Customer", entityId: id, metadata: { amount: data.amount, method: data.method }, request });
  return result;
}
