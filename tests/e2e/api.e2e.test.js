// End-to-end HTTP tests against a RUNNING server (bun run dev / bun run start).
//   E2E_BASE_URL=http://localhost:3000 bun test tests/e2e
// Registers fresh businesses each run (unique emails), so it is safe to repeat.
import { beforeAll, describe, expect, test } from "bun:test";

const BASE = process.env.E2E_BASE_URL;
const stamp = Date.now().toString(36);

class Client {
  constructor() {
    this.cookie = "";
  }
  async req(path, { method = "GET", body, headers = {}, raw = false } = {}) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      redirect: "manual",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        Origin: BASE,
        ...headers,
      },
      body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) {
      const m = /sp_session=([^;]*)/.exec(set);
      if (m) this.cookie = m[1] ? `sp_session=${m[1]}` : "";
    }
    if (raw) return res;
    let json = null;
    try {
      json = await res.json();
    } catch {}
    return { status: res.status, json, headers: res.headers };
  }
}

describe.skipIf(!BASE)("HTTP API end-to-end", () => {
  const owner = new Client();
  const other = new Client();
  const cashier = new Client();
  let productId;

  beforeAll(async () => {
    const reg = (c, n) =>
      c.req("/api/auth/register", {
        method: "POST",
        body: { businessName: `E2E Shop ${n} ${stamp}`, ownerName: `Owner ${n}`, email: `owner${n}.${stamp}@e2e.test`, phone: "08012345678", password: "Password123", country: "NG", businessType: "Supermarket" },
      });
    expect((await reg(owner, "a")).status).toBe(201);
    expect((await reg(other, "b")).status).toBe(201);
  });

  test("session cookie authenticates /api/auth/me and trial is active", async () => {
    const me = await owner.req("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.json.user.role).toBe("owner");
    expect(me.json.access.state).toBe("trialing");
    expect(me.json.access.daysLeft).toBe(7);
  });

  test("unauthenticated API calls are rejected and pages redirect to /login (proxy.js)", async () => {
    const anon = new Client();
    expect((await anon.req("/api/products")).status).toBe(401);
    const page = await anon.req("/dashboard", { raw: true });
    expect([307, 308]).toContain(page.status);
    expect(page.headers.get("location")).toContain("/login");
  });

  test("cross-site POSTs are blocked (CSRF origin check)", async () => {
    const r = await owner.req("/api/products", { method: "POST", body: { name: "X", sellingPrice: 1 }, headers: { Origin: "https://evil.example" } });
    expect(r.status).toBe(403);
  });

  test("owner creates a product; the other tenant cannot see or change it (IDOR)", async () => {
    const r = await owner.req("/api/products", { method: "POST", body: { name: "Coca-Cola 50cl", sellingPrice: 450, costPrice: 330, quantity: 24, unit: "bottle" } });
    expect(r.status).toBe(200);
    productId = r.json.product._id;
    expect((await other.req(`/api/products/${productId}`)).status).toBe(404);
    expect((await other.req(`/api/products/${productId}`, { method: "PATCH", body: { sellingPrice: 1 } })).status).toBe(404);
    expect((await other.req(`/api/products/${productId}`, { method: "DELETE" })).status).toBe(404);
    const list = await other.req("/api/products");
    expect(list.json.items.some((p) => p._id === productId)).toBe(false);
  });

  test("client-supplied tenantId is ignored", async () => {
    const meB = await other.req("/api/auth/me");
    const r = await owner.req("/api/customers", { method: "POST", body: { name: "Sneaky", tenantId: meB.json.tenant.id } });
    expect(r.status).toBe(200);
    const listB = await other.req("/api/customers");
    expect(listB.json.items.some((c) => c.name === "Sneaky")).toBe(false);
  });

  test("invited cashier gets POS access but not admin powers (server-side RBAC)", async () => {
    const inv = await owner.req("/api/staff", { method: "POST", body: { email: `cashier.${stamp}@e2e.test`, role: "cashier" } });
    expect(inv.status).toBe(200);
    const token = new URL(inv.json.inviteLink).searchParams.get("token");
    const acc = await cashier.req("/api/auth/accept-invite", { method: "POST", body: { token, name: "Cash Ier", password: "Password123" } });
    expect(acc.status).toBe(201);

    const sale = await cashier.req("/api/sales", { method: "POST", body: { items: [{ productId, quantity: 2 }], paymentMethod: "cash" } });
    expect(sale.status).toBe(200);
    expect(sale.json.sale.total).toBe(900);

    expect((await cashier.req(`/api/products/${productId}`, { method: "DELETE" })).status).toBe(403);
    expect((await cashier.req("/api/reports?type=profit")).status).toBe(403);
    expect((await cashier.req("/api/staff")).status).toBe(403);
    expect((await cashier.req("/api/subscriptions/checkout", { method: "POST", body: { planId: "000000000000000000000000" } })).status).toBe(403);
    expect((await cashier.req(`/api/sales/${sale.json.sale._id}/cancel`, { method: "POST", body: {} })).status).toBe(403);
  });

  test("sale reduced stock and created a movement", async () => {
    const p = await owner.req(`/api/products/${productId}`);
    expect(p.json.product.quantity).toBe(22);
    expect(p.json.movements.some((m) => m.type === "sale" && m.quantity === -2)).toBe(true);
  });

  test("trial plan features are gated (expenses need Starter+)", async () => {
    const r = await owner.req("/api/expenses", { method: "POST", body: { category: "rent", amount: 1000 } });
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe("PLAN_FEATURE");
  });

  test("webhook rejects bad signatures; cron rejects missing secret", async () => {
    const wh = await owner.req("/api/paystack/webhook", { method: "POST", body: { event: "charge.success", data: { reference: "x" } }, headers: { "x-paystack-signature": "bad" } });
    expect(wh.status).toBe(401);
    const anon = new Client();
    expect((await anon.req("/api/cron/all")).status).toBe(401);
  });

  test("validation errors return 422 with field details (no raw DB errors)", async () => {
    const r = await owner.req("/api/products", { method: "POST", body: { name: "", sellingPrice: -5 } });
    expect(r.status).toBe(422);
    expect(r.json.error.details.name).toBeDefined();
  });

  test("logout clears the session", async () => {
    const c = new Client();
    c.cookie = other.cookie;
    await c.req("/api/auth/logout", { method: "POST" });
    expect((await c.req("/api/auth/me")).status).toBe(401);
  });
});
