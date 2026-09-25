// Reporting & analytics — all aggregations are tenant-scoped and indexed on
// {tenantId, createdAt}. Revenue excludes tax. Gross profit = revenue − COGS.
// Net profit = gross profit − expenses.
import Sale from "../models/Sale.js";
import SaleItem from "../models/SaleItem.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Customer from "../models/Customer.js";
import Supplier from "../models/Supplier.js";
import Expense from "../models/Expense.js";
import Purchase from "../models/Purchase.js";
import { scoped } from "./_scope.js";
import { round2 } from "../lib/money.js";
import { dayKeys, resolveRange } from "../utils/dates.js";

const r2 = (n) => round2(n || 0);

export async function salesSummary(ctx, { from, to }) {
  const match = scoped(ctx, { createdAt: { $gte: from, $lt: to } });
  const [agg] = await Sale.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        count: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
        totalSales: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$total", 0] } },
        subtotal: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$subtotal", 0] } },
        discounts: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$discount", 0] } },
        tax: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$tax", 0] } },
        cogs: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$costOfGoods", 0] } },
        grossProfit: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$grossProfit", 0] } },
        amountPaid: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$amountPaid", 0] } },
        balance: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$balance", 0] } },
        items: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$itemCount", 0] } },
      },
    },
  ]);
  const a = agg || {};
  const revenue = r2((a.subtotal || 0) - (a.discounts || 0));
  return {
    count: a.count || 0,
    cancelled: a.cancelled || 0,
    totalSales: r2(a.totalSales),
    revenue,
    discounts: r2(a.discounts),
    tax: r2(a.tax),
    cogs: r2(a.cogs),
    grossProfit: r2(a.grossProfit),
    amountPaid: r2(a.amountPaid),
    balance: r2(a.balance),
    items: a.items || 0,
    averageSale: a.count ? r2(a.totalSales / a.count) : 0,
  };
}

export async function salesByDay(ctx, { from, to }) {
  const tz = ctx.timezone || "Africa/Lagos";
  const rows = await Sale.aggregate([
    { $match: scoped(ctx, { status: "completed", createdAt: { $gte: from, $lt: to } }) },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: tz } },
        revenue: { $sum: { $subtract: ["$subtotal", "$discount"] } },
        total: { $sum: "$total" },
        profit: { $sum: "$grossProfit" },
        count: { $sum: 1 },
      },
    },
  ]);
  const map = new Map(rows.map((r) => [r._id, r]));
  return dayKeys(from, to, tz).map((key) => {
    const r = map.get(key);
    return { date: key, revenue: r2(r?.revenue), total: r2(r?.total), profit: r2(r?.profit), count: r?.count || 0 };
  });
}

export async function salesByPaymentMethod(ctx, { from, to }) {
  const rows = await Sale.aggregate([
    { $match: scoped(ctx, { status: "completed", createdAt: { $gte: from, $lt: to } }) },
    { $group: { _id: "$paymentMethod", total: { $sum: "$total" }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);
  return rows.map((r) => ({ method: r._id, total: r2(r.total), count: r.count }));
}

export async function topProducts(ctx, { from, to }, limit = 10) {
  const rows = await SaleItem.aggregate([
    { $match: scoped(ctx, { status: "completed", createdAt: { $gte: from, $lt: to } }) },
    {
      $group: {
        _id: "$productId",
        name: { $last: "$name" },
        quantity: { $sum: "$quantity" },
        revenue: { $sum: "$lineTotal" },
        cost: { $sum: "$lineCost" },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: limit },
  ]);
  return rows.map((r) => ({ productId: String(r._id), name: r.name, quantity: r.quantity, revenue: r2(r.revenue), profit: r2(r.revenue - r.cost) }));
}

export async function expensesSummary(ctx, { from, to }) {
  const match = scoped(ctx, { date: { $gte: from, $lt: to } });
  const tz = ctx.timezone || "Africa/Lagos";
  const [byCategory, byDay] = await Promise.all([
    Expense.aggregate([{ $match: match }, { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),
    Expense.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: tz } }, total: { $sum: "$amount" } } },
    ]),
  ]);
  const total = r2(byCategory.reduce((s, c) => s + c.total, 0));
  const dayMap = new Map(byDay.map((d) => [d._id, d.total]));
  return {
    total,
    count: byCategory.reduce((s, c) => s + c.count, 0),
    byCategory: byCategory.map((c) => ({ category: c._id, total: r2(c.total), count: c.count })),
    byDay: dayKeys(from, to, tz).map((k) => ({ date: k, total: r2(dayMap.get(k)) })),
  };
}

export async function profitReport(ctx, range) {
  const [sales, expenses, daily] = await Promise.all([salesSummary(ctx, range), expensesSummary(ctx, range), salesByDay(ctx, range)]);
  const expenseMap = new Map(expenses.byDay.map((d) => [d.date, d.total]));
  const netProfit = r2(sales.grossProfit - expenses.total);
  return {
    revenue: sales.revenue,
    cogs: sales.cogs,
    grossProfit: sales.grossProfit,
    grossMargin: sales.revenue ? r2((sales.grossProfit / sales.revenue) * 100) : 0,
    expenses: expenses.total,
    netProfit,
    netMargin: sales.revenue ? r2((netProfit / sales.revenue) * 100) : 0,
    discounts: sales.discounts,
    tax: sales.tax,
    transactions: sales.count,
    expensesByCategory: expenses.byCategory,
    daily: daily.map((d) => ({ date: d.date, revenue: d.revenue, grossProfit: d.profit, expenses: expenseMap.get(d.date) || 0, netProfit: r2(d.profit - (expenseMap.get(d.date) || 0)) })),
  };
}

export async function inventoryReport(ctx, { lowLimit = 50 } = {}) {
  const base = scoped(ctx, { isDeleted: false });
  const [[totals], byCategory, lowStock, cats] = await Promise.all([
    Product.aggregate([
      { $match: base },
      {
        $group: {
          _id: null,
          products: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
          quantity: { $sum: { $max: ["$quantity", 0] } },
          costValue: { $sum: { $multiply: [{ $max: ["$quantity", 0] }, "$costPrice"] } },
          retailValue: { $sum: { $multiply: [{ $max: ["$quantity", 0] }, "$sellingPrice"] } },
          lowStock: { $sum: { $cond: [{ $and: [{ $lte: ["$quantity", "$minimumStockLevel"] }, { $gt: ["$quantity", 0] }] }, 1, 0] } },
          outOfStock: { $sum: { $cond: [{ $lte: ["$quantity", 0] }, 1, 0] } },
        },
      },
    ]),
    Product.aggregate([
      { $match: base },
      {
        $group: {
          _id: "$categoryId",
          products: { $sum: 1 },
          quantity: { $sum: { $max: ["$quantity", 0] } },
          costValue: { $sum: { $multiply: [{ $max: ["$quantity", 0] }, "$costPrice"] } },
          retailValue: { $sum: { $multiply: [{ $max: ["$quantity", 0] }, "$sellingPrice"] } },
        },
      },
      { $sort: { costValue: -1 } },
    ]),
    Product.find({ ...base, $expr: { $lte: ["$quantity", "$minimumStockLevel"] } })
      .sort({ quantity: 1 })
      .limit(lowLimit)
      .select("name sku quantity minimumStockLevel unit costPrice sellingPrice")
      .lean(),
    Category.find(scoped(ctx)).select("name").lean(),
  ]);
  const catMap = new Map(cats.map((c) => [String(c._id), c.name]));
  const t = totals || {};
  return {
    totalProducts: t.products || 0,
    activeProducts: t.active || 0,
    totalQuantity: round2(t.quantity || 0),
    inventoryValue: r2(t.costValue),
    retailValue: r2(t.retailValue),
    potentialProfit: r2((t.retailValue || 0) - (t.costValue || 0)),
    lowStockCount: t.lowStock || 0,
    outOfStockCount: t.outOfStock || 0,
    byCategory: byCategory.map((c) => ({
      category: c._id ? catMap.get(String(c._id)) || "Uncategorised" : "Uncategorised",
      products: c.products,
      quantity: round2(c.quantity),
      costValue: r2(c.costValue),
      retailValue: r2(c.retailValue),
    })),
    lowStock,
  };
}

export async function customerReport(ctx, { from, to }) {
  const [totalCustomers, newCustomers, top, debtors, [balances]] = await Promise.all([
    Customer.countDocuments(scoped(ctx, { isDeleted: false })),
    Customer.countDocuments(scoped(ctx, { isDeleted: false, createdAt: { $gte: from, $lt: to } })),
    Sale.aggregate([
      { $match: scoped(ctx, { status: "completed", customerId: { $ne: null }, createdAt: { $gte: from, $lt: to } }) },
      { $group: { _id: "$customerId", name: { $last: "$customerName" }, total: { $sum: "$total" }, count: { $sum: 1 }, balance: { $sum: "$balance" } } },
      { $sort: { total: -1 } },
      { $limit: 20 },
    ]),
    Customer.find(scoped(ctx, { isDeleted: false, balance: { $gt: 0 } })).sort({ balance: -1 }).limit(50).select("name phone balance totalPurchases lastPurchaseAt").lean(),
    Customer.aggregate([{ $match: scoped(ctx, { isDeleted: false }) }, { $group: { _id: null, outstanding: { $sum: "$balance" }, purchases: { $sum: "$totalPurchases" } } }]),
  ]);
  return {
    totalCustomers,
    newCustomers,
    outstanding: r2(balances?.outstanding),
    lifetimePurchases: r2(balances?.purchases),
    topCustomers: top.map((t) => ({ customerId: String(t._id), name: t.name, total: r2(t.total), count: t.count, balance: r2(t.balance) })),
    debtors,
  };
}

/** Everything the dashboard needs in one round of parallel queries. */
export async function dashboardData(ctx) {
  const tz = ctx.timezone || "Africa/Lagos";
  const today = resolveRange("today", { tz });
  const month = resolveRange("this_month", { tz });
  const last30 = resolveRange("last_30_days", { tz });

  const [
    todaySales,
    monthSales,
    monthExpenses,
    productCount,
    lowStockCount,
    customerCount,
    supplierCount,
    [custBal],
    [suppBal],
    recentSales,
    recentPurchases,
    trend,
    top,
    methods,
  ] = await Promise.all([
    salesSummary(ctx, today),
    salesSummary(ctx, month),
    expensesSummary(ctx, month),
    Product.countDocuments(scoped(ctx, { isDeleted: false })),
    Product.countDocuments(scoped(ctx, { isDeleted: false, status: "active", $expr: { $lte: ["$quantity", "$minimumStockLevel"] } })),
    Customer.countDocuments(scoped(ctx, { isDeleted: false })),
    Supplier.countDocuments(scoped(ctx, { isDeleted: false })),
    Customer.aggregate([{ $match: scoped(ctx, { isDeleted: false }) }, { $group: { _id: null, total: { $sum: "$balance" } } }]),
    Supplier.aggregate([{ $match: scoped(ctx, { isDeleted: false }) }, { $group: { _id: null, total: { $sum: "$balance" } } }]),
    Sale.find(scoped(ctx)).sort({ createdAt: -1 }).limit(6).select("invoiceNumber customerName total paymentMethod status createdAt paymentStatus").lean(),
    Purchase.find(scoped(ctx)).sort({ purchaseDate: -1, createdAt: -1 }).limit(5).select("referenceNumber supplierName total paymentStatus purchaseDate status").lean(),
    salesByDay(ctx, last30),
    topProducts(ctx, month, 5),
    salesByPaymentMethod(ctx, month),
  ]);

  return {
    today: todaySales,
    month: { ...monthSales, expenses: monthExpenses.total, netProfit: r2(monthSales.grossProfit - monthExpenses.total) },
    counts: { products: productCount, lowStock: lowStockCount, customers: customerCount, suppliers: supplierCount },
    balances: { customers: r2(custBal?.total), suppliers: r2(suppBal?.total) },
    expensesByCategory: monthExpenses.byCategory,
    recentSales,
    recentPurchases,
    trend,
    topProducts: top,
    paymentMethods: methods,
  };
}
