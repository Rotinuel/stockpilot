import { describe, expect, test } from "bun:test";
import { registerSchema, productSchema, productUpdateSchema, saleSchema, purchaseSchema, expenseSchema, customerSchema, planSchema, stockTransferSchema, inviteSchema } from "../../lib/validators.js";
import { normalizeError } from "../../lib/errors.js";

describe("Input validation", () => {
  test("registration requires every field and a strong-enough password", () => {
    const ok = registerSchema.safeParse({ businessName: "Shop", ownerName: "Ada", email: "ADA@Shop.com ", phone: "0803 123 4567", password: "Password1", country: "NG", businessType: "Supermarket" });
    expect(ok.success).toBe(true);
    expect(ok.data.email).toBe("ada@shop.com");
    const bad = registerSchema.safeParse({ businessName: "", email: "nope", phone: "abc", password: "short" });
    expect(bad.success).toBe(false);
    const err = normalizeError(bad.error);
    expect(err.status).toBe(422);
    expect(Object.keys(err.details)).toEqual(expect.arrayContaining(["businessName", "ownerName", "email", "phone", "password"]));
  });

  test("operator-injection objects are rejected instead of reaching MongoDB", () => {
    expect(registerSchema.safeParse({ businessName: "S", ownerName: "A", email: { $gt: "" }, phone: "0803", password: "Password1", country: "NG", businessType: "x" }).success).toBe(false);
    expect(saleSchema.safeParse({ items: [{ productId: { $ne: null }, quantity: 1 }] }).success).toBe(false);
  });

  test("unknown keys such as tenantId are stripped", () => {
    const r = customerSchema.parse({ name: "Ada", tenantId: "650000000000000000000000", balance: 1e9 });
    expect(r.tenantId).toBeUndefined();
    expect(r.balance).toBeUndefined();
  });

  test("product: coercion, defaults and empty optional strings", () => {
    const r = productSchema.parse({ name: "Milo", sellingPrice: "4100", costPrice: "", sku: "", barcode: "", categoryId: "", unit: "pack" });
    expect(r.sellingPrice).toBe(4100);
    expect(r.costPrice).toBe(0);
    expect(r.sku).toBeUndefined();
    expect(r.categoryId).toBeNull();
    expect(productSchema.safeParse({ name: "X", sellingPrice: -1 }).success).toBe(false);
    expect(productSchema.safeParse({ name: "X", sellingPrice: 1, unit: "spaceship" }).success).toBe(false);
  });

  test("product update: 'none' clears references and barcode can be removed", () => {
    const r = productUpdateSchema.parse({ categoryId: "none", supplierId: "", barcode: "" });
    expect(r.categoryId).toBeNull();
    expect(r.supplierId).toBeNull();
    expect(r.barcode).toBeNull();
  });

  test("sales need at least one positive line; client prices are ignored", () => {
    expect(saleSchema.safeParse({ items: [] }).success).toBe(false);
    expect(saleSchema.safeParse({ items: [{ productId: "650000000000000000000000", quantity: 0 }] }).success).toBe(false);
    const r = saleSchema.parse({ items: [{ productId: "650000000000000000000000", quantity: "2", unitPrice: 1 }] });
    expect(r.items[0]).toEqual({ productId: "650000000000000000000000", quantity: 2 });
    expect(r.paymentMethod).toBe("cash");
  });

  test("purchases, expenses, transfers, invites and plans", () => {
    expect(purchaseSchema.parse({ items: [{ productId: "650000000000000000000000", quantity: 5, unitCost: "100" }] }).updateCostPrice).toBe(true);
    expect(expenseSchema.safeParse({ category: "rent", amount: 0 }).success).toBe(false);
    expect(expenseSchema.parse({ category: "electricity", amount: "4500" }).date instanceof Date).toBe(true);
    expect(stockTransferSchema.safeParse({ productId: "650000000000000000000000", fromLocationId: "650000000000000000000001", toLocationId: "650000000000000000000001", quantity: 1 }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: "a@b.co", role: "owner" }).success).toBe(false);
    const plan = planSchema.parse({ code: "business", name: "Business", price: "10000", limits: { products: 2000, staffUsers: 10, locations: 1, monthlyTransactions: -1 }, features: { expenses: true } });
    expect(plan.price).toBe(10000);
    expect(plan.features.export).toBe(false);
  });
});
