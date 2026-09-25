import Expense from "../models/Expense.js";
import { byId, scoped } from "./_scope.js";
import { notFound } from "../lib/errors.js";
import { escapeRegex } from "../utils/slug.js";
import { logAudit } from "./audit.js";
import { round2 } from "../lib/money.js";
import { resolveLocation } from "./locations.js";

export async function listExpenses(ctx, { search, category, from, to, page = 1, limit = 20 } = {}) {
  const filter = scoped(ctx);
  if (search) filter.description = { $regex: escapeRegex(search.trim()), $options: "i" };
  if (category) filter.category = category;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lt = to;
  }
  const [items, total, sums, byCategory] = await Promise.all([
    Expense.find(filter).sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Expense.countDocuments(filter),
    Expense.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
    Expense.aggregate([{ $match: filter }, { $group: { _id: "$category", total: { $sum: "$amount" } } }, { $sort: { total: -1 } }]),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), summary: sums[0] || { total: 0, count: 0 }, byCategory };
}

export async function createExpense(ctx, data, request) {
  const location = await resolveLocation(ctx, data.locationId);
  const expense = await Expense.create({
    ...data,
    amount: round2(data.amount),
    locationId: location._id,
    tenantId: ctx.tenantId,
    createdBy: ctx.userId,
    createdByName: ctx.userName,
  });
  await logAudit(ctx, "expense.create", { entity: "Expense", entityId: expense._id, metadata: { category: expense.category, amount: expense.amount }, request });
  return expense.toObject();
}

export async function updateExpense(ctx, id, data, request) {
  const { locationId, ...rest } = data;
  if (rest.amount !== undefined) rest.amount = round2(rest.amount);
  const expense = await Expense.findOneAndUpdate(byId(ctx, id), { $set: rest }, { new: true, runValidators: true }).lean();
  if (!expense) throw notFound("Expense not found.");
  await logAudit(ctx, "expense.update", { entity: "Expense", entityId: expense._id, metadata: { category: expense.category, amount: expense.amount }, request });
  return expense;
}

export async function deleteExpense(ctx, id, request) {
  const expense = await Expense.findOneAndDelete(byId(ctx, id)).lean();
  if (!expense) throw notFound("Expense not found.");
  await logAudit(ctx, "expense.delete", { entity: "Expense", entityId: expense._id, metadata: { category: expense.category, amount: expense.amount }, request });
  return { ok: true };
}
