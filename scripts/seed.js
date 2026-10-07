#!/usr/bin/env bun
// StockPilot seed script.
//   bun run seed           → plans, settings, super admin, demo tenants (skips what already exists)
//   bun run seed --reset   → deletes and recreates the two DEMO tenants only (never other data)
//
// Bun loads .env / .env.local automatically.
import crypto from "node:crypto";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../lib/db.js";
import { hashPassword } from "../lib/auth/password.js";
import { trialWindow, addDays } from "../lib/access.js";
import { round2, computeCartTotals, settlePayment } from "../lib/money.js";
import * as M from "../models/index.js";
import { PLANS, CATEGORIES, PRODUCTS, SUPPLIERS, CUSTOMERS, EXPENSES_MONTHLY } from "./seed-data.js";
import { applyTrialLengthToAll } from "../services/trial.js";

const RESET = process.argv.includes("--reset");
const DEMO_PASSWORD = "Demo@12345";
const DEMO_SLUGS = ["mama-nkechi-supermarket", "chuks-provision-store"];
const oid = () => new mongoose.Types.ObjectId();

// Deterministic PRNG so demo data looks the same on every run.
let seedState = 20260925;
function rand() {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (a, b) => a + Math.floor(rand() * (b - a + 1));

/** Build a document with schema defaults applied, without Mongoose timestamps overriding our dates. */
function build(Model, doc) {
  return new Model(doc).toObject({ depopulate: true, virtuals: false, versionKey: false });
}

async function insert(Model, docs) {
  if (!docs.length) return;
  for (let i = 0; i < docs.length; i += 1000) {
    await Model.collection.insertMany(docs.slice(i, i + 1000), { ordered: false });
  }
}

/** A Lagos-local timestamp `daysAgo` days back at a business hour. */
function lagosTime(daysAgo, hour = randInt(8, 20), minute = randInt(0, 59)) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour - 1, minute, randInt(0, 59), 0); // Lagos = UTC+1
  return d > new Date() ? new Date(Date.now() - randInt(5, 90) * 60000) : d;
}

async function ensureIndexes() {
  for (const Model of Object.values(M)) {
    try {
      await Model.createIndexes();
    } catch (err) {
      console.warn(`  ! index build for ${Model.modelName}: ${err.message}`);
    }
  }
}

async function seedPlans() {
  for (const plan of PLANS) {
    // $setOnInsert: never overwrite prices a super admin has changed.
    await M.SubscriptionPlan.updateOne({ code: plan.code }, { $setOnInsert: plan }, { upsert: true });
    // Fill in USD prices on plans created before global pricing existed (only when missing/0).
    if (plan.usdPrice) {
      await M.SubscriptionPlan.updateOne({ code: plan.code, $or: [{ usdPrice: { $exists: false } }, { usdPrice: 0 }] }, { $set: { usdPrice: plan.usdPrice } });
    }
    // The trial length is a business rule (TRIAL_DAYS); keep the trial plan's display in sync.
    if (plan.isTrial) await M.SubscriptionPlan.updateOne({ code: plan.code }, { $set: { durationDays: plan.durationDays, description: plan.description } });
  }
  const plans = await M.SubscriptionPlan.find({}).lean();
  console.log(`✓ Plans: ${plans.map((p) => `${p.name} (₦${p.price.toLocaleString()})`).join(", ")}`);
  return Object.fromEntries(plans.map((p) => [p.code, p]));
}

async function seedPlatformSettings() {
  await M.PlatformSetting.updateOne({ key: "global" }, { $setOnInsert: { key: "global", gracePeriodDays: 3, allowRegistrations: true, supportEmail: "support@stockpilot.ng", defaultCurrency: "NGN" } }, { upsert: true });
  console.log("✓ Platform settings");
}

async function seedSuperAdmin() {
  const email = (process.env.SUPER_ADMIN_EMAIL || "admin@stockpilot.ng").toLowerCase();
  const existing = await M.User.findOne({ email }).lean();
  if (existing) {
    console.log(`✓ Super admin exists: ${email}`);
    return;
  }
  const password = process.env.SUPER_ADMIN_PASSWORD || `Admin-${crypto.randomBytes(5).toString("hex")}1`;
  await M.User.create({ name: process.env.SUPER_ADMIN_NAME || "Platform Admin", email, password: await hashPassword(password), role: "super_admin", tenantId: null, emailVerified: true, isActive: true });
  console.log(`✓ Super admin created: ${email} / ${password}${process.env.SUPER_ADMIN_PASSWORD ? " (from SUPER_ADMIN_PASSWORD)" : "  ← save this password"}`);
}

async function wipeDemoTenants() {
  const tenants = await M.Tenant.find({ slug: { $in: DEMO_SLUGS } }).select("_id").lean();
  const ids = tenants.map((t) => t._id);
  if (!ids.length) return;
  for (const Model of Object.values(M)) {
    if (Model.schema.path("tenantId")) await Model.deleteMany({ tenantId: { $in: ids } });
  }
  await M.Referral.deleteMany({ $or: [{ referrerTenantId: { $in: ids } }, { referredTenantId: { $in: ids } }] });
  await M.Tenant.deleteMany({ _id: { $in: ids } });
  console.log(`✓ Removed ${ids.length} existing demo tenant(s)`);
}

async function createDemoSupermarket(plans, passwordHash) {
  const slug = DEMO_SLUGS[0];
  if (await M.Tenant.exists({ slug })) {
    console.log(`• Demo tenant "${slug}" already exists (use --reset to recreate)`);
    return;
  }
  const now = new Date();
  const tenantId = oid();
  const plan = plans.professional;
  const created = addDays(now, -62);
  const { trialStartedAt, trialEndsAt } = trialWindow(created);

  const users = {
    owner: { _id: oid(), name: "Nkechi Okonkwo", email: "demo@stockpilot.ng", role: "owner" },
    manager: { _id: oid(), name: "Segun Adewale", email: "manager@stockpilot.ng", role: "manager" },
    cashier: { _id: oid(), name: "Blessing Udoh", email: "cashier@stockpilot.ng", role: "cashier" },
    stock: { _id: oid(), name: "Musa Garba", email: "stock@stockpilot.ng", role: "inventory_staff" },
  };
  for (const u of Object.values(users)) {
    if (await M.User.exists({ email: u.email })) throw new Error(`User ${u.email} already exists outside the demo tenant. Remove it or run with --reset.`);
  }

  const mainLoc = { _id: oid(), tenantId, name: "Main Store — Surulere", address: "24 Bode Thomas Street, Surulere, Lagos", phone: "08030000001", isDefault: true, isActive: true, managerId: users.manager._id };
  const yabaLoc = { _id: oid(), tenantId, name: "Yaba Branch", address: "5 Herbert Macaulay Way, Yaba, Lagos", phone: "08030000002", isDefault: false, isActive: true };

  await insert(M.Tenant, [
    build(M.Tenant, {
      _id: tenantId,
      businessName: "Mama Nkechi Supermarket",
      slug,
      ownerId: users.owner._id,
      email: "demo@stockpilot.ng",
      phone: "+2348030000001",
      whatsappNumber: "+2348030000001",
      referralCode: "MAMADEMO",
      address: "24 Bode Thomas Street, Surulere, Lagos",
      country: "NG",
      currency: "NGN",
      businessType: "Supermarket",
      subscriptionPlan: plan._id,
      subscriptionPlanCode: plan.code,
      subscriptionStatus: "active",
      trialStartedAt,
      trialEndsAt,
      subscriptionStartDate: addDays(now, -10),
      subscriptionEndDate: addDays(now, 20),
      nextBillingDate: addDays(now, 20),
      cancelAtPeriodEnd: true, // demo: manual subscription (no Paystack card on file)
      settings: { taxRate: 7.5, taxLabel: "VAT", invoicePrefix: "MNS", purchasePrefix: "PO", receiptFooter: "Thank you for shopping with Mama Nkechi! Goods sold in good condition are not returnable." },
      onboarding: { completed: true, step: 6, completedAt: created },
      remindersSent: ["trial-5", "trial-3", "trial-1"],
      createdAt: created,
      updatedAt: now,
    }),
  ]);

  await insert(
    M.User,
    Object.values(users).map((u) =>
      build(M.User, { ...u, tenantId, password: passwordHash, phone: "0803" + randInt(1000000, 9999999), isActive: true, emailVerified: true, defaultLocationId: mainLoc._id, lastLoginAt: addDays(now, -randInt(0, 3)), createdAt: created, updatedAt: now }),
    ),
  );
  await insert(M.Location, [build(M.Location, { ...mainLoc, createdAt: created, updatedAt: now }), build(M.Location, { ...yabaLoc, createdAt: addDays(now, -30), updatedAt: now })]);

  await insert(M.Subscription, [
    build(M.Subscription, { tenantId, planId: plans.trial._id, planCode: "trial", status: "expired", amount: 0, currentPeriodStart: trialStartedAt, currentPeriodEnd: trialEndsAt, endedAt: trialEndsAt, changeType: "new", createdAt: created, updatedAt: trialEndsAt }),
    build(M.Subscription, { tenantId, planId: plans.business._id, planCode: "business", status: "expired", amount: plans.business.price, interval: "monthly", currentPeriodStart: addDays(now, -55), currentPeriodEnd: addDays(now, -25), endedAt: addDays(now, -25), changeType: "manual", createdAt: addDays(now, -55), updatedAt: addDays(now, -25) }),
    build(M.Subscription, { tenantId, planId: plan._id, planCode: plan.code, status: "active", amount: plan.price, interval: "monthly", currentPeriodStart: addDays(now, -10), currentPeriodEnd: addDays(now, 20), cancelAtPeriodEnd: true, changeType: "manual", createdAt: addDays(now, -10), updatedAt: now }),
  ]);

  // Catalogue
  const catDocs = CATEGORIES.map((name) => build(M.Category, { _id: oid(), tenantId, name, createdAt: created, updatedAt: created }));
  await insert(M.Category, catDocs);
  const catId = Object.fromEntries(catDocs.map((c) => [c.name, c._id]));

  const supplierDocs = SUPPLIERS.map((s) => ({ ...s, _id: oid(), tenantId, balance: 0, totalPurchases: 0, totalPaid: 0, purchaseCount: 0, createdBy: users.owner._id, createdAt: created, updatedAt: created }));
  const customerDocs = CUSTOMERS.map((c, i) => ({ ...c, _id: oid(), tenantId, balance: 0, totalPurchases: 0, totalPaid: 0, purchaseCount: 0, createdBy: users.owner._id, createdAt: addDays(created, i * 3), updatedAt: now }));

  const products = PRODUCTS.map(([name, sku, barcode, category, brand, cost, price, unit, minLevel, openingQty, popularity, supplierIdx]) => ({
    _id: oid(),
    tenantId,
    name,
    sku,
    barcode: barcode || undefined,
    categoryId: catId[category],
    brand,
    costPrice: cost,
    sellingPrice: price,
    quantity: 0,
    minimumStockLevel: minLevel,
    unit,
    supplierId: supplierDocs[supplierIdx]._id,
    status: "active",
    isDeleted: false,
    createdBy: users.owner._id,
    createdAt: created,
    updatedAt: now,
    _opening: openingQty,
    _pop: popularity,
  }));

  // ── Simulate history chronologically so stock, balances and ledgers agree ──
  const stock = new Map(); // `${productId}:${locationId}` → qty
  const total = new Map(); // productId → qty
  const movements = [];
  const key = (p, l) => `${p}:${l}`;
  const move = (product, locationId, delta, type, at, extra = {}) => {
    const prevTotal = total.get(String(product._id)) || 0;
    const prevLoc = stock.get(key(product._id, locationId)) || 0;
    const newLoc = round2(prevLoc + delta);
    const newTotal = extra.affectsTotal === false ? prevTotal : round2(prevTotal + delta);
    stock.set(key(product._id, locationId), newLoc);
    total.set(String(product._id), newTotal);
    movements.push(
      build(M.InventoryMovement, {
        tenantId,
        productId: product._id,
        productName: product.name,
        locationId,
        type,
        quantity: delta,
        previousQuantity: prevTotal,
        newQuantity: newTotal,
        locationPreviousQuantity: prevLoc,
        locationNewQuantity: newLoc,
        unitCost: extra.unitCost ?? product.costPrice,
        reason: extra.reason,
        referenceId: extra.referenceId,
        referenceType: extra.referenceType || null,
        referenceNumber: extra.referenceNumber,
        performedBy: extra.by || users.owner._id,
        performedByName: extra.byName || users.owner.name,
        createdAt: at,
      }),
    );
  };

  // Opening stock
  for (const p of products) move(p, mainLoc._id, p._opening, "opening_stock", addDays(created, 0), { reason: "Opening stock", referenceId: p._id, referenceType: "Product" });
  // Yaba branch opening via transfer of fast movers
  for (const p of products.filter((x) => x._pop >= 4).slice(0, 8)) {
    const qty = Math.floor(p._opening * 0.2);
    const at = addDays(now, -29);
    move(p, mainLoc._id, -qty, "transfer", at, { reason: "Transfer Main Store → Yaba Branch", referenceType: "Transfer", affectsTotal: false, by: users.stock._id, byName: users.stock.name });
    move(p, yabaLoc._id, qty, "transfer", at, { reason: "Transfer Main Store → Yaba Branch", referenceType: "Transfer", affectsTotal: false, by: users.stock._id, byName: users.stock.name });
  }

  // Events: purchases on fixed days, sales daily
  const purchaseDays = [50, 42, 33, 24, 15, 8, 3];
  const purchases = [];
  const purchaseItems = [];
  const sales = [];
  const saleItems = [];
  const payments = [];
  let poSeq = 0;
  let invSeq = 0;
  const weighted = products.flatMap((p) => Array(p._pop * p._pop).fill(p));

  for (let day = 60; day >= 0; day--) {
    if (purchaseDays.includes(day)) {
      const supplier = supplierDocs[purchaseDays.indexOf(day) % supplierDocs.length];
      let items = products.filter((p) => String(p.supplierId) === String(supplier._id));
      if (!items.length) items = products.slice(0, 5);
      const at = lagosTime(day, 10);
      const purchaseId = oid();
      const ref = `PO-${String(++poSeq).padStart(6, "0")}`;
      let subtotal = 0;
      for (const p of items) {
        const qty = Math.max(p.minimumStockLevel * 2, 6);
        move(p, mainLoc._id, qty, "purchase", at, { unitCost: p.costPrice, reason: `Purchase ${ref} from ${supplier.name}`, referenceId: purchaseId, referenceType: "Purchase", referenceNumber: ref, by: users.manager._id, byName: users.manager.name });
        const lineTotal = round2(qty * p.costPrice);
        subtotal += lineTotal;
        purchaseItems.push(build(M.PurchaseItem, { tenantId, purchaseId, productId: p._id, name: p.name, sku: p.sku, unit: p.unit, quantity: qty, unitCost: p.costPrice, lineTotal, createdAt: at }));
      }
      const other = day % 2 ? 5000 : 0;
      const totalAmt = round2(subtotal + other);
      const paid = day <= 8 ? round2(totalAmt * 0.6) : totalAmt;
      const pay = settlePayment(totalAmt, paid);
      purchases.push(
        build(M.Purchase, {
          _id: purchaseId,
          tenantId,
          referenceNumber: ref,
          invoiceNumber: `SUP-${randInt(10000, 99999)}`,
          locationId: mainLoc._id,
          supplierId: supplier._id,
          supplierName: supplier.name,
          itemCount: items.length,
          subtotal: round2(subtotal),
          otherCharges: other,
          total: totalAmt,
          amountPaid: pay.amountPaid,
          balance: pay.balance,
          paymentStatus: pay.paymentStatus,
          paymentMethod: "bank_transfer",
          purchaseDate: at,
          status: "completed",
          createdBy: users.manager._id,
          createdByName: users.manager.name,
          createdAt: at,
          updatedAt: at,
        }),
      );
      supplier.balance = round2(supplier.balance + pay.balance);
      supplier.totalPurchases = round2(supplier.totalPurchases + totalAmt);
      supplier.totalPaid = round2(supplier.totalPaid + pay.amountPaid);
      supplier.purchaseCount += 1;
      supplier.lastPurchaseAt = at;
    }

    // Sales for the day (weekends busier)
    const weekday = lagosTime(day, 12).getUTCDay();
    const count = randInt(4, 8) + (weekday === 6 || weekday === 0 ? 3 : 0);
    for (let s = 0; s < count; s++) {
      const at = lagosTime(day);
      const locationId = rand() < 0.25 && day <= 28 ? yabaLoc._id : mainLoc._id;
      const lines = new Map();
      const n = randInt(1, 4);
      for (let i = 0; i < n; i++) {
        const p = pick(weighted);
        const q = p.unit === "carton" || p.unit === "bag" ? 1 : randInt(1, p._pop >= 4 ? 4 : 2);
        lines.set(p, (lines.get(p) || 0) + q);
      }
      const valid = [...lines.entries()].filter(([p, q]) => (stock.get(key(p._id, locationId)) || 0) >= q);
      if (!valid.length) continue;
      const cashier = locationId === yabaLoc._id ? users.manager : rand() < 0.7 ? users.cashier : users.owner;
      const customer = rand() < 0.3 ? pick(customerDocs) : null;
      const discountValue = rand() < 0.08 ? 5 : 0;
      const totals = computeCartTotals(
        valid.map(([p, q]) => ({ quantity: q, unitPrice: p.sellingPrice, costPrice: p.costPrice })),
        { discountType: "percent", discountValue, taxRate: 7.5 },
      );
      const credit = customer && customer.type === "credit" && rand() < 0.35;
      const tendered = credit ? round2(totals.total * pick([0, 0.5])) : rand() < 0.5 ? Math.ceil(totals.total / 1000) * 1000 : totals.total;
      const pay = settlePayment(totals.total, tendered);
      const saleId = oid();
      const invoiceNumber = `MNS-${String(++invSeq).padStart(6, "0")}`;
      const method = credit && pay.amountPaid === 0 ? "cash" : pick(["cash", "cash", "pos", "pos", "bank_transfer", "card"]);
      for (const [p, q] of valid) {
        move(p, locationId, -q, "sale", at, { reason: `Sale ${invoiceNumber}`, referenceId: saleId, referenceType: "Sale", referenceNumber: invoiceNumber, by: cashier._id, byName: cashier.name });
        saleItems.push(
          build(M.SaleItem, { tenantId, saleId, productId: p._id, locationId, name: p.name, sku: p.sku, unit: p.unit, quantity: q, unitPrice: p.sellingPrice, costPrice: p.costPrice, lineTotal: round2(q * p.sellingPrice), lineCost: round2(q * p.costPrice), status: "completed", createdAt: at }),
        );
      }
      sales.push(
        build(M.Sale, {
          _id: saleId,
          tenantId,
          invoiceNumber,
          locationId,
          customerId: customer?._id || null,
          customerName: customer?.name || "Walk-in customer",
          itemCount: valid.reduce((a, [, q]) => a + q, 0),
          subtotal: totals.subtotal,
          discountType: "percent",
          discountValue,
          discount: totals.discount,
          taxRate: 7.5,
          tax: totals.tax,
          total: totals.total,
          amountTendered: round2(tendered),
          amountPaid: pay.amountPaid,
          balance: pay.balance,
          change: pay.change,
          paymentMethod: method,
          paymentStatus: pay.paymentStatus,
          costOfGoods: totals.costOfGoods,
          grossProfit: totals.grossProfit,
          cashierId: cashier._id,
          cashierName: cashier.name,
          status: "completed",
          createdAt: at,
          updatedAt: at,
        }),
      );
      if (customer) {
        customer.balance = round2(customer.balance + pay.balance);
        customer.totalPurchases = round2(customer.totalPurchases + totals.total);
        customer.totalPaid = round2(customer.totalPaid + pay.amountPaid);
        customer.purchaseCount += 1;
        customer.lastPurchaseAt = at;
      }
    }
  }

  // Cancel one recent sale (and return its stock) to demonstrate reversals
  const toCancel = sales.filter((s) => s.paymentStatus === "paid" && !s.customerId).at(-5);
  if (toCancel) {
    const at = new Date(toCancel.createdAt.getTime() + 15 * 60000);
    toCancel.status = "cancelled";
    toCancel.cancelledAt = at;
    toCancel.cancelledBy = users.manager._id;
    toCancel.cancelReason = "Customer changed their mind";
    for (const it of saleItems.filter((i) => String(i.saleId) === String(toCancel._id))) {
      it.status = "cancelled";
      const p = products.find((x) => String(x._id) === String(it.productId));
      move(p, it.locationId, it.quantity, "return", at, { reason: `Sale ${toCancel.invoiceNumber} cancelled: Customer changed their mind`, referenceId: toCancel._id, referenceType: "Sale", referenceNumber: toCancel.invoiceNumber, by: users.manager._id, byName: users.manager.name });
    }
  }

  // A damaged-stock adjustment
  const eggsLike = products.find((p) => p.sku === "BRD-AGEGE-L");
  if (eggsLike && (stock.get(key(eggsLike._id, mainLoc._id)) || 0) >= 3) {
    move(eggsLike, mainLoc._id, -3, "damage", lagosTime(2, 18), { reason: "Expired — past best-before date", referenceType: "Adjustment", by: users.stock._id, byName: users.stock.name });
  }

  // Customer part-payments (FIFO against their unpaid sales)
  const balancePayments = [];
  for (const c of customerDocs.filter((x) => x.balance > 2000).slice(0, 3)) {
    const amount = round2(Math.floor((c.balance * 0.4) / 100) * 100);
    if (amount <= 0) continue;
    let remaining = amount;
    const allocations = [];
    for (const s of sales.filter((x) => String(x.customerId) === String(c._id) && x.balance > 0 && x.status === "completed").sort((a, b) => a.createdAt - b.createdAt)) {
      if (remaining <= 0) break;
      const apply = round2(Math.min(remaining, s.balance));
      s.amountPaid = round2(s.amountPaid + apply);
      s.balance = round2(s.balance - apply);
      s.paymentStatus = s.balance <= 0 ? "paid" : "partial";
      allocations.push({ referenceType: "Sale", referenceId: s._id, referenceNumber: s.invoiceNumber, amount: apply });
      remaining = round2(remaining - apply);
    }
    const before = c.balance;
    c.balance = round2(c.balance - amount);
    c.totalPaid = round2(c.totalPaid + amount);
    balancePayments.push(build(M.BalancePayment, { tenantId, partyType: "customer", partyId: c._id, amount, method: "bank_transfer", note: "Part payment", allocations, balanceBefore: before, balanceAfter: c.balance, recordedBy: users.owner._id, recordedByName: users.owner.name, createdAt: lagosTime(1, 11) }));
  }

  // Cancelled-sale reversals on customers were not needed (walk-in). Finalise products & per-location stock.
  for (const p of products) {
    p.quantity = total.get(String(p._id)) || 0;
    delete p._opening;
    delete p._pop;
  }
  const productStocks = [];
  for (const [k, qty] of stock) {
    const [productId, locationId] = k.split(":");
    productStocks.push(build(M.ProductStock, { tenantId, productId, locationId, quantity: qty, createdAt: created, updatedAt: now }));
  }

  // Expenses: two months + this month so far
  const expenses = [];
  for (const monthsAgo of [2, 1, 0]) {
    for (const [category, description, amount] of EXPENSES_MONTHLY) {
      const day = monthsAgo * 30 + (monthsAgo === 0 ? randInt(0, 4) : randInt(1, 25));
      if (day > 60) continue;
      expenses.push(build(M.Expense, { tenantId, locationId: mainLoc._id, category, description, amount: round2(amount * (0.9 + rand() * 0.2)), paymentMethod: pick(["cash", "bank_transfer"]), date: lagosTime(day, 12), createdBy: users.owner._id, createdByName: users.owner.name, createdAt: lagosTime(day, 12), updatedAt: lagosTime(day, 12) }));
    }
  }

  // Demo subscription payment (clearly marked as seed data)
  payments.push(
    build(M.Payment, { tenantId, planId: plan._id, planCode: plan.code, reference: `SEED-DEMO-${tenantId.toString().slice(-6)}`, amount: plan.price, currency: "NGN", status: "success", purpose: "upgrade", channel: "bank_transfer", gatewayResponse: "Seed data (manual activation)", paidAt: addDays(now, -10), verifiedAt: addDays(now, -10), verifiedVia: "admin", customerEmail: users.owner.email, createdAt: addDays(now, -10), updatedAt: addDays(now, -10) }),
  );

  await insert(M.Supplier, supplierDocs.map((s) => build(M.Supplier, s)));
  await insert(M.Customer, customerDocs.map((c) => build(M.Customer, c)));
  await insert(M.Product, products.map((p) => build(M.Product, p)));
  await insert(M.ProductStock, productStocks);
  await insert(M.Purchase, purchases);
  await insert(M.PurchaseItem, purchaseItems);
  await insert(M.Sale, sales);
  await insert(M.SaleItem, saleItems);
  await insert(M.InventoryMovement, movements);
  await insert(M.BalancePayment, balancePayments);
  await insert(M.Expense, expenses);
  await insert(M.Payment, payments);
  await insert(M.Counter, [
    { tenantId, key: "sale", seq: invSeq },
    { tenantId, key: "purchase", seq: poSeq },
    { tenantId, key: "sku", seq: 100 },
  ]);

  const lowCount = products.filter((p) => p.quantity <= p.minimumStockLevel).length;
  await insert(M.Notification, [
    build(M.Notification, { tenantId, type: "low_stock", severity: "warning", roles: ["owner", "admin", "manager", "inventory_staff"], title: `${lowCount} products are running low`, message: "Review your low-stock list and restock before you run out.", link: "/inventory/low-stock", readBy: [], createdAt: lagosTime(0, 8) }),
    build(M.Notification, { tenantId, type: "payment_success", severity: "success", roles: ["owner", "admin"], title: "You're on the Professional plan", message: "Your subscription is active.", link: "/billing", readBy: [users.owner._id], createdAt: addDays(now, -10) }),
    build(M.Notification, { tenantId, type: "announcement", severity: "info", title: "Welcome to StockPilot demo", message: "This workspace contains sample Nigerian retail data so you can explore every feature.", readBy: [], createdAt: addDays(now, -1) }),
  ]);
  await insert(M.AuditLog, [
    { tenantId, userId: users.owner._id, userName: users.owner.name, userRole: "owner", action: "auth.register", entity: "Tenant", entityId: tenantId, metadata: { businessName: "Mama Nkechi Supermarket" }, timestamp: created },
    { tenantId, userId: users.owner._id, userName: users.owner.name, userRole: "owner", action: "staff.invite", entity: "Invitation", metadata: { email: users.cashier.email, role: "cashier" }, timestamp: addDays(created, 1) },
    { tenantId, userId: users.manager._id, userName: users.manager.name, userRole: "manager", action: "sale.cancel", entity: "Sale", entityId: toCancel?._id, metadata: { invoiceNumber: toCancel?.invoiceNumber, reason: "Customer changed their mind" }, timestamp: toCancel?.cancelledAt || now },
    { tenantId, userId: users.stock._id, userName: users.stock.name, userRole: "inventory_staff", action: "inventory.adjust", entity: "Product", entityId: eggsLike?._id, metadata: { action: "damage", delta: -3 }, timestamp: lagosTime(2, 18) },
    { tenantId, userId: users.owner._id, userName: users.owner.name, userRole: "owner", action: "auth.login", entity: "User", entityId: users.owner._id, metadata: {}, timestamp: now },
  ]);

  console.log(`✓ Demo tenant "Mama Nkechi Supermarket" (Professional plan)`);
  console.log(`    ${products.length} products · ${sales.length} sales · ${purchases.length} purchases · ${customerDocs.length} customers · ${expenses.length} expenses · ${movements.length} stock movements`);
  console.log(`    Logins (password ${DEMO_PASSWORD}): demo@stockpilot.ng (owner), manager@stockpilot.ng, cashier@stockpilot.ng, stock@stockpilot.ng`);
}

async function createTrialShop(plans, passwordHash) {
  const slug = DEMO_SLUGS[1];
  if (await M.Tenant.exists({ slug })) {
    console.log(`• Demo tenant "${slug}" already exists`);
    return;
  }
  if (await M.User.exists({ email: "trial@stockpilot.ng" })) throw new Error("trial@stockpilot.ng already exists. Run with --reset.");
  const now = new Date();
  const tenantId = oid();
  const ownerId = oid();
  const started = addDays(now, -1); // → 2 days left of the 3-day trial, shows the countdown
  const { trialStartedAt, trialEndsAt } = trialWindow(started);
  const loc = { _id: oid(), tenantId, name: "Main Store", isDefault: true, isActive: true, address: "Shop 14, Ariaria Market, Aba" };
  await insert(M.Tenant, [
    build(M.Tenant, { _id: tenantId, businessName: "Chuks Provision Store", slug, ownerId, email: "trial@stockpilot.ng", phone: "+2348039990000", whatsappNumber: "+2348039990000", country: "NG", currency: "NGN", businessType: "Provision store", address: loc.address, subscriptionPlan: plans.trial._id, subscriptionPlanCode: "trial", subscriptionStatus: "trialing", trialStartedAt, trialEndsAt, onboarding: { completed: true, step: 6 }, remindersSent: [], createdAt: started, updatedAt: now }),
  ]);
  await insert(M.User, [build(M.User, { _id: ownerId, tenantId, name: "Chukwudi Eze", email: "trial@stockpilot.ng", password: passwordHash, role: "owner", emailVerified: false, isActive: true, defaultLocationId: loc._id, createdAt: started, updatedAt: now })]);
  await insert(M.Location, [build(M.Location, { ...loc, createdAt: started, updatedAt: started })]);
  await insert(M.Subscription, [build(M.Subscription, { tenantId, planId: plans.trial._id, planCode: "trial", status: "trialing", amount: 0, currentPeriodStart: trialStartedAt, currentPeriodEnd: trialEndsAt, changeType: "new", createdAt: started, updatedAt: started })]);
  const few = PRODUCTS.slice(0, 8).map(([name, sku, , , brand, cost, price, unit, minLevel]) => ({ _id: oid(), tenantId, name, sku, brand, costPrice: cost, sellingPrice: price, unit, minimumStockLevel: minLevel, quantity: minLevel + 10, status: "active", isDeleted: false, createdAt: started, updatedAt: started }));
  await insert(M.Product, few.map((p) => build(M.Product, p)));
  await insert(M.ProductStock, few.map((p) => build(M.ProductStock, { tenantId, productId: p._id, locationId: loc._id, quantity: p.quantity, createdAt: started, updatedAt: started })));
  await insert(M.InventoryMovement, few.map((p) => build(M.InventoryMovement, { tenantId, productId: p._id, productName: p.name, locationId: loc._id, type: "opening_stock", quantity: p.quantity, previousQuantity: 0, newQuantity: p.quantity, locationPreviousQuantity: 0, locationNewQuantity: p.quantity, reason: "Opening stock", referenceType: "Product", referenceId: p._id, performedBy: ownerId, performedByName: "Chukwudi Eze", createdAt: started })));
  await insert(M.Counter, [{ tenantId, key: "sku", seq: 10 }]);
  console.log(`✓ Demo tenant "Chuks Provision Store" (free trial, ends ${trialEndsAt.toDateString()}) — trial@stockpilot.ng / ${DEMO_PASSWORD}`);
}

/** The trial shop "signed up" with the supermarket's referral link (shows on Refer & earn). */
async function linkDemoReferral() {
  const [demo, trial] = await Promise.all(DEMO_SLUGS.slice(0, 2).map((slug) => M.Tenant.findOne({ slug }).select("_id referralCode createdAt").lean()));
  if (!demo || !trial) return;
  if (!demo.referralCode) await M.Tenant.updateOne({ _id: demo._id }, { $set: { referralCode: "MAMADEMO" } });
  if (await M.Referral.exists({ referredTenantId: trial._id })) return;
  await M.Referral.create({ referrerTenantId: demo._id, referredTenantId: trial._id, code: demo.referralCode || "MAMADEMO", status: "signed_up", signedUpAt: trial.createdAt });
  await M.Tenant.updateOne({ _id: trial._id }, { $set: { referredBy: demo._id } });
  console.log("✓ Demo referral: Chuks Provision Store joined with Mama Nkechi's link (code MAMADEMO)");
}

/**
 * Make sure every demo login works: re-creates a missing trial owner (e.g. after an
 * interrupted seed), resets demo passwords to Demo@12345 and clears lockouts.
 */
async function repairDemoLogins(passwordHash) {
  const trial = await M.Tenant.findOne({ slug: DEMO_SLUGS[1] }).lean();
  if (trial && !(await M.User.exists({ email: "trial@stockpilot.ng" }))) {
    const loc = await M.Location.findOne({ tenantId: trial._id, isDefault: true }).lean();
    const ownerId = trial.ownerId || oid();
    await insert(M.User, [build(M.User, { _id: ownerId, tenantId: trial._id, name: "Chukwudi Eze", email: "trial@stockpilot.ng", password: passwordHash, role: "owner", emailVerified: false, isActive: true, defaultLocationId: loc?._id || null, createdAt: trial.createdAt, updatedAt: new Date() })]);
    await M.Tenant.updateOne({ _id: trial._id }, { $set: { ownerId, status: "active" } });
    console.log("✓ Re-created missing trial owner account");
  }
  const emails = ["demo@stockpilot.ng", "manager@stockpilot.ng", "cashier@stockpilot.ng", "stock@stockpilot.ng", "trial@stockpilot.ng"];
  const res = await M.User.updateMany(
    { email: { $in: emails }, role: { $ne: "super_admin" } },
    { $set: { password: passwordHash, isActive: true, failedLoginAttempts: 0 }, $unset: { lockedUntil: 1 } },
  );
  await M.Tenant.updateMany({ slug: { $in: DEMO_SLUGS } }, { $set: { status: "active" } });
  console.log(`✓ Demo logins ready (${res.matchedCount} accounts, password ${DEMO_PASSWORD})`);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.");
    process.exit(1);
  }
  console.log("Seeding StockPilot…");
  await connectDB(uri);
  await ensureIndexes();
  const plans = await seedPlans();
  await seedPlatformSettings();
  await seedSuperAdmin();
  if (RESET) await wipeDemoTenants();
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  // Each demo business is independent: a problem with one never blocks the other.
  for (const [label, fn] of [["demo supermarket", createDemoSupermarket], ["trial shop", createTrialShop]]) {
    try {
      await fn(plans, passwordHash);
    } catch (err) {
      process.exitCode = 1;
      console.error(`✗ Could not create the ${label}: ${err.message}\n  Tip: run "bun run seed:reset" to recreate the demo businesses.`);
    }
  }
  await repairDemoLogins(passwordHash);
  const trials = await applyTrialLengthToAll();
  if (trials.updated) console.log(`✓ Shortened ${trials.updated} existing 7-day trial(s) to 3 days`);
  await linkDemoReferral();
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
