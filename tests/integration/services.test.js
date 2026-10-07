// Integration tests against a real MongoDB (preferably a replica set so the
// transactional paths run). The database at MONGODB_URI_TEST is DROPPED.
//   MONGODB_URI_TEST="mongodb://127.0.0.1:27017/stockpilot_test?replicaSet=rs0" bun run test:integration
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import mongoose from "mongoose";

const URI = process.env.MONGODB_URI_TEST;

describe.skipIf(!URI)("StockPilot services (MongoDB)", () => {
  let M, auth, products, sales, purchases, stock, customers, suppliers, billing, cron, plansSvc, access, PLANS;
  let A, B; // { user, tenant, ctx }
  const realFetch = globalThis.fetch;
  const paystackCalls = [];

  async function makeCtx(userId, planOverride) {
    const user = await M.User.findById(userId).lean();
    const tenant = await M.Tenant.findById(user.tenantId).lean();
    const plan = planOverride || (await plansSvc.getEffectivePlan(tenant));
    const loc = await M.Location.findOne({ tenantId: tenant._id, isDefault: true }).lean();
    return {
      tenantId: tenant._id,
      userId: user._id,
      userName: user.name,
      role: user.role,
      settings: tenant.settings || {},
      currency: tenant.currency,
      timezone: "Africa/Lagos",
      locationId: loc._id,
      plan,
      access: access.computeAccess(tenant),
    };
  }

  const expectStatus = async (promise, status) => {
    let err;
    try {
      await promise;
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.status).toBe(status);
    return err;
  };

  beforeAll(async () => {
    M = await import("../../models/index.js");
    const db = await import("../../lib/db.js");
    auth = await import("../../services/auth.js");
    products = await import("../../services/products.js");
    sales = await import("../../services/sales.js");
    purchases = await import("../../services/purchases.js");
    stock = await import("../../services/stock.js");
    customers = await import("../../services/customers.js");
    suppliers = await import("../../services/suppliers.js");
    billing = await import("../../services/billing.js");
    cron = await import("../../services/cron.js");
    plansSvc = await import("../../services/plans.js");
    access = await import("../../lib/access.js");
    ({ PLANS } = await import("../../scripts/seed-data.js"));

    await db.connectDB(URI);
    await mongoose.connection.db.dropDatabase();
    for (const Model of Object.values(M)) await Model.createIndexes();
    await M.SubscriptionPlan.insertMany(PLANS);
    plansSvc.invalidatePlanCache();

    const reqA = { businessName: "Alpha Stores", ownerName: "Ada Alpha", email: "ada@alpha.test", phone: "08010000001", password: "Password1", country: "NG", businessType: "Supermarket" };
    const reqB = { businessName: "Beta Mart", ownerName: "Bola Beta", email: "bola@beta.test", phone: "08010000002", password: "Password1", country: "NG", businessType: "Pharmacy" };
    const ra = await auth.registerBusiness(reqA);
    const rb = await auth.registerBusiness(reqB);
    A = { user: ra.user, tenant: ra.tenant, ctx: await makeCtx(ra.user._id) };
    B = { user: rb.user, tenant: rb.tenant, ctx: await makeCtx(rb.user._id) };
  });

  afterAll(async () => {
    globalThis.fetch = realFetch;
    await mongoose.disconnect();
  });

  // ── Registration & trial ─────────────────────────────────
  test("registration creates owner + tenant + default location + exactly 3-day trial", async () => {
    expect(A.user.role).toBe("owner");
    expect(String(A.user.tenantId)).toBe(String(A.tenant._id));
    expect(A.tenant.subscriptionStatus).toBe("trialing");
    expect(A.tenant.subscriptionPlanCode).toBe("trial");
    expect(new Date(A.tenant.trialEndsAt) - new Date(A.tenant.trialStartedAt)).toBe(3 * 24 * 3600 * 1000);
    expect(await M.Location.countDocuments({ tenantId: A.tenant._id, isDefault: true })).toBe(1);
  });

  test("duplicate email registration is rejected", async () => {
    await expectStatus(auth.registerBusiness({ businessName: "X", ownerName: "X", email: "ada@alpha.test", phone: "0801", password: "Password1", country: "NG", businessType: "Other retail" }), 409);
  });

  test("login works with the right password only", async () => {
    const { token } = await auth.login({ email: "ada@alpha.test", password: "Password1" });
    expect(typeof token).toBe("string");
    await expectStatus(auth.login({ email: "ada@alpha.test", password: "wrong-pass1" }), 401);
  });

  // ── Products & tenant isolation ─────────────────────────
  let productA;
  test("product creation records opening stock as an inventory movement", async () => {
    productA = await products.createProduct(A.ctx, { name: "Indomie 70g", sellingPrice: 320, costPrice: 240, quantity: 50, minimumStockLevel: 10, unit: "pack" });
    expect(productA.quantity).toBe(50);
    const moves = await M.InventoryMovement.find({ tenantId: A.tenant._id, productId: productA._id }).lean();
    expect(moves).toHaveLength(1);
    expect(moves[0].type).toBe("opening_stock");
    expect(moves[0].newQuantity).toBe(50);
  });

  test("tenant B cannot read, list, update, delete, adjust or sell tenant A's product (IDOR)", async () => {
    const id = String(productA._id);
    await expectStatus(products.getProduct(B.ctx, id), 404);
    await expectStatus(products.updateProduct(B.ctx, id, { sellingPrice: 1 }), 404);
    await expectStatus(products.deleteProduct(B.ctx, id), 404);
    await expectStatus(stock.adjustStock(B.ctx, { productId: id, action: "remove", quantity: 1 }), 404);
    await expectStatus(sales.createSale(B.ctx, { items: [{ productId: id, quantity: 1 }], paymentMethod: "cash", discountType: "amount", discountValue: 0 }), 400);
    const listB = await products.listProducts(B.ctx, {});
    expect(listB.items.find((p) => String(p._id) === id)).toBeUndefined();
    const fresh = await M.Product.findById(id).lean();
    expect(fresh.sellingPrice).toBe(320);
    expect(fresh.quantity).toBe(50);
  });

  test("scoped() refuses to run without a tenant context", async () => {
    const { scoped } = await import("../../services/_scope.js");
    expect(() => scoped({}, {})).toThrow();
  });

  test("tenant B cannot read tenant A's customers, suppliers or sales", async () => {
    const cust = await customers.createCustomer(A.ctx, { name: "Alpha Customer", type: "credit", creditLimit: 0 });
    const sup = await suppliers.createSupplier(A.ctx, { name: "Alpha Supplier" });
    await expectStatus(customers.getCustomer(B.ctx, String(cust._id)), 404);
    await expectStatus(customers.updateCustomer(B.ctx, String(cust._id), { name: "hacked" }), 404);
    await expectStatus(suppliers.getSupplier(B.ctx, String(sup._id)), 404);
    const sale = await sales.createSale(A.ctx, { items: [{ productId: String(productA._id), quantity: 1 }], paymentMethod: "cash", discountType: "amount", discountValue: 0 });
    await expectStatus(sales.getSale(B.ctx, String(sale.sale._id)), 404);
    await expectStatus(sales.cancelSale(B.ctx, String(sale.sale._id), {}), 404);
  });

  // ── Plan limits ───────────────────────────────────────────
  test("product limit is enforced server-side with a helpful message", async () => {
    const tiny = { ...A.ctx.plan, limits: { ...A.ctx.plan.limits, products: 2 } };
    const ctx = { ...B.ctx, plan: tiny };
    await products.createProduct(ctx, { name: "P1", sellingPrice: 10 });
    await products.createProduct(ctx, { name: "P2", sellingPrice: 10 });
    const err = await expectStatus(products.createProduct(ctx, { name: "P3", sellingPrice: 10 }), 403);
    expect(err.code).toBe("PLAN_LIMIT");
    expect(err.message).toBe("You have reached your 2-product limit. Upgrade your plan to add more products.");
  });

  // ── Sales & inventory ────────────────────────────────────
  test("completed sale reduces stock, writes movements and stores profit", async () => {
    const before = (await M.Product.findById(productA._id).lean()).quantity;
    const res = await sales.createSale(A.ctx, { items: [{ productId: String(productA._id), quantity: 3 }], paymentMethod: "pos", discountType: "amount", discountValue: 0, amountTendered: 2000 });
    expect(res.sale.total).toBe(960);
    expect(res.sale.costOfGoods).toBe(720);
    expect(res.sale.grossProfit).toBe(240);
    expect(res.sale.change).toBe(1040);
    const after = (await M.Product.findById(productA._id).lean()).quantity;
    expect(after).toBe(before - 3);
    const mv = await M.InventoryMovement.findOne({ tenantId: A.tenant._id, referenceId: res.sale._id }).lean();
    expect(mv.type).toBe("sale");
    expect(mv.quantity).toBe(-3);
    expect(mv.previousQuantity).toBe(before);
    expect(mv.newQuantity).toBe(after);
  });

  test("insufficient stock fails the whole sale without partial changes", async () => {
    const p2 = await products.createProduct(A.ctx, { name: "Peak Milk", sellingPrice: 800, costPrice: 640, quantity: 2 });
    const before = (await M.Product.findById(productA._id).lean()).quantity;
    const salesBefore = await M.Sale.countDocuments({ tenantId: A.tenant._id });
    await expectStatus(
      sales.createSale(A.ctx, { items: [{ productId: String(productA._id), quantity: 1 }, { productId: String(p2._id), quantity: 5 }], paymentMethod: "cash", discountType: "amount", discountValue: 0 }),
      400,
    );
    expect((await M.Product.findById(productA._id).lean()).quantity).toBe(before);
    expect((await M.Product.findById(p2._id).lean()).quantity).toBe(2);
    expect(await M.Sale.countDocuments({ tenantId: A.tenant._id })).toBe(salesBefore);
  });

  test("credit sales need a customer and the customer-balances feature", async () => {
    await expectStatus(sales.createSale(A.ctx, { items: [{ productId: String(productA._id), quantity: 1 }], paymentMethod: "cash", discountType: "amount", discountValue: 0, amountTendered: 0 }), 400);
    const cust = await customers.createCustomer(A.ctx, { name: "Trial Credit", type: "credit", creditLimit: 0 });
    const err = await expectStatus(sales.createSale(A.ctx, { items: [{ productId: String(productA._id), quantity: 1 }], customerId: String(cust._id), paymentMethod: "cash", discountType: "amount", discountValue: 0, amountTendered: 0 }), 403);
    expect(err.code).toBe("PLAN_FEATURE"); // trial plan lacks customerBalances
  });

  test("cancelling a sale reverses stock and customer balance", async () => {
    const business = await plansSvc.getPlanByCode("business");
    const ctx = { ...A.ctx, plan: business };
    const cust = await customers.createCustomer(ctx, { name: "Mama Blessing", type: "credit", creditLimit: 0 });
    const before = (await M.Product.findById(productA._id).lean()).quantity;
    const res = await sales.createSale(ctx, { items: [{ productId: String(productA._id), quantity: 2 }], customerId: String(cust._id), paymentMethod: "cash", discountType: "amount", discountValue: 0, amountTendered: 100 });
    expect(res.sale.balance).toBe(540);
    expect((await M.Customer.findById(cust._id).lean()).balance).toBe(540);
    await sales.cancelSale(ctx, String(res.sale._id), { reason: "test" });
    expect((await M.Product.findById(productA._id).lean()).quantity).toBe(before);
    const c = await M.Customer.findById(cust._id).lean();
    expect(c.balance).toBe(0);
    expect(c.totalPurchases).toBe(0);
    const ret = await M.InventoryMovement.findOne({ referenceId: res.sale._id, type: "return" }).lean();
    expect(ret.quantity).toBe(2);
    await expectStatus(sales.cancelSale(ctx, String(res.sale._id), {}), 400); // no double cancel
  });

  test("duplicate POS submissions (same clientRequestId) create one sale", async () => {
    const body = { items: [{ productId: String(productA._id), quantity: 1 }], paymentMethod: "cash", discountType: "amount", discountValue: 0, clientRequestId: "req-123" };
    const a = await sales.createSale(A.ctx, body);
    const b = await sales.createSale(A.ctx, body);
    expect(String(a.sale._id)).toBe(String(b.sale._id));
  });

  test("purchase increases stock, updates cost price and supplier balance", async () => {
    const business = await plansSvc.getPlanByCode("business");
    const ctx = { ...A.ctx, plan: business };
    const sup = await suppliers.createSupplier(ctx, { name: "Dufil Depot" });
    const before = (await M.Product.findById(productA._id).lean()).quantity;
    const res = await purchases.createPurchase(ctx, { supplierId: String(sup._id), items: [{ productId: String(productA._id), quantity: 40, unitCost: 250 }], otherCharges: 0, amountPaid: 6000, paymentMethod: "bank_transfer", updateCostPrice: true });
    expect(res.purchase.total).toBe(10000);
    expect(res.purchase.balance).toBe(4000);
    const p = await M.Product.findById(productA._id).lean();
    expect(p.quantity).toBe(before + 40);
    expect(p.costPrice).toBe(250);
    expect((await M.Supplier.findById(sup._id).lean()).balance).toBe(4000);
    const pay = await suppliers.recordSupplierPayment(ctx, String(sup._id), { amount: 4000, method: "cash" });
    expect(pay.balance).toBe(0);
    expect((await M.Purchase.findById(res.purchase._id).lean()).paymentStatus).toBe("paid");
  });

  test("stock adjustments always create movements (set / damage)", async () => {
    const count = await M.InventoryMovement.countDocuments({ productId: productA._id });
    await stock.adjustStock(A.ctx, { productId: String(productA._id), action: "set", quantity: 10, reason: "count" });
    await stock.adjustStock(A.ctx, { productId: String(productA._id), action: "damage", quantity: 2, reason: "broken" });
    expect((await M.Product.findById(productA._id).lean()).quantity).toBe(8);
    expect(await M.InventoryMovement.countDocuments({ productId: productA._id })).toBe(count + 2);
    await expectStatus(stock.adjustStock(A.ctx, { productId: String(productA._id), action: "remove", quantity: 100 }), 400);
  });

  // ── Subscription lifecycle ───────────────────────────────
  test("trial expiry cron marks tenant expired → read-only, data kept", async () => {
    await M.Tenant.updateOne({ _id: B.tenant._id }, { $set: { trialEndsAt: new Date(Date.now() - 1000) } });
    const res = await cron.expireTrials(new Date());
    expect(res.expired).toBeGreaterThanOrEqual(1);
    const t = await M.Tenant.findById(B.tenant._id).lean();
    expect(t.subscriptionStatus).toBe("expired");
    expect(access.computeAccess(t).canWrite).toBe(false);
    expect(await M.Product.countDocuments({ tenantId: B.tenant._id })).toBeGreaterThan(0);
  });

  test("Paystack checkout → verified charge.success webhook activates the plan (idempotently)", async () => {
    const plan = await plansSvc.getPlanByCode("business");
    globalThis.fetch = async (url, opts = {}) => {
      const u = String(url);
      paystackCalls.push(u);
      const json = (data) => new Response(JSON.stringify({ status: true, message: "ok", data }), { status: 200, headers: { "content-type": "application/json" } });
      if (u.endsWith("/plan")) return json({ plan_code: "PLN_business_test" });
      if (u.includes("/transaction/initialize")) {
        const body = JSON.parse(opts.body);
        return json({ authorization_url: "https://checkout.paystack.com/test", access_code: "ac", reference: body.reference });
      }
      if (u.includes("/transaction/verify/")) {
        const ref = decodeURIComponent(u.split("/").pop());
        const payment = await M.Payment.findOne({ reference: ref }).lean();
        return json({
          id: 99,
          status: "success",
          reference: ref,
          amount: Math.round(payment.amount * 100),
          currency: "NGN",
          paid_at: new Date().toISOString(),
          channel: "card",
          gateway_response: "Approved",
          metadata: JSON.stringify({ tenantId: String(payment.tenantId) }),
          customer: { customer_code: "CUS_test", email: "bola@beta.test" },
          authorization: { authorization_code: "AUTH_test", reusable: true, last4: "4081", brand: "visa" },
          plan: { plan_code: "PLN_business_test" },
        });
      }
      return new Response(JSON.stringify({ status: false, message: "unexpected" }), { status: 404 });
    };
    const ctx = await makeCtx(B.user._id);
    const checkout = await billing.startCheckout(ctx, String(plan._id));
    expect(checkout.authorizationUrl).toBe("https://checkout.paystack.com/test");
    const payment = await M.Payment.findOne({ reference: checkout.reference }).lean();
    expect(payment.status).toBe("pending");

    // Frontend can't fake success: tenant is still expired until verification.
    expect((await M.Tenant.findById(B.tenant._id).lean()).subscriptionStatus).toBe("expired");

    await billing.handlePaystackEvent({ event: "charge.success", data: { reference: checkout.reference } });
    const t = await M.Tenant.findById(B.tenant._id).lean();
    expect(t.subscriptionStatus).toBe("active");
    expect(t.subscriptionPlanCode).toBe("business");
    expect(access.computeAccess(t).canWrite).toBe(true);

    await billing.handlePaystackEvent({ event: "charge.success", data: { reference: checkout.reference } });
    expect(await M.Subscription.countDocuments({ tenantId: B.tenant._id, status: "active" })).toBe(1);
    expect(await M.Payment.countDocuments({ tenantId: B.tenant._id, status: "success" })).toBe(1);

    // Another tenant cannot verify B's reference (IDOR)
    await expectStatus(billing.verifyAndApply(checkout.reference, { expectedTenantId: A.tenant._id }), 404);
  });

  test("invoice.payment_failed moves the subscription to past_due with a grace period", async () => {
    await M.Tenant.updateOne({ _id: B.tenant._id }, { $set: { paystackSubscriptionCode: "SUB_test" } });
    await billing.handlePaystackEvent({ event: "invoice.payment_failed", data: { subscription: { subscription_code: "SUB_test" }, invoice_code: "INV_fail_1", amount: 1000000 } });
    const t = await M.Tenant.findById(B.tenant._id).lean();
    expect(t.subscriptionStatus).toBe("past_due");
    expect(new Date(t.graceEndsAt) > new Date()).toBe(true);
    expect(access.computeAccess(t).canWrite).toBe(true); // still within grace
  });
});
