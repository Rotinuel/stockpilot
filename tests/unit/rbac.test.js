import { describe, expect, test } from "bun:test";
import { can, assignableRoles, canManageUser, permissionsFor } from "../../lib/rbac.js";

describe("RBAC", () => {
  test("owner has full access including billing management", () => {
    for (const p of ["products:delete", "billing:manage", "staff:manage", "reports:profit", "expenses:manage"]) expect(can("owner", p)).toBe(true);
  });

  test("admin cannot manage subscription ownership", () => {
    expect(can("admin", "billing:view")).toBe(true);
    expect(can("admin", "billing:manage")).toBe(false);
    expect(can("admin", "staff:manage")).toBe(true);
  });

  test("cashier can use POS and view products/customers but not delete, manage staff, billing or view profit", () => {
    expect(can("cashier", "pos:use")).toBe(true);
    expect(can("cashier", "sales:create")).toBe(true);
    expect(can("cashier", "products:view")).toBe(true);
    expect(can("cashier", "customers:view")).toBe(true);
    for (const p of ["products:delete", "products:create", "staff:manage", "billing:manage", "billing:view", "reports:profit", "reports:sales", "expenses:view", "sales:cancel", "sales:view_all", "products:view_cost"]) {
      expect(can("cashier", p)).toBe(false);
    }
  });

  test("owner can optionally allow cashiers to see sales reports only", () => {
    const settings = { allowCashierReports: true };
    expect(can("cashier", "reports:sales", settings)).toBe(true);
    expect(can("cashier", "reports:profit", settings)).toBe(false);
  });

  test("inventory staff can view products, add stock, adjust inventory and see inventory reports", () => {
    for (const p of ["products:view", "inventory:adjust", "inventory:view", "reports:inventory"]) expect(can("inventory_staff", p)).toBe(true);
    for (const p of ["pos:use", "sales:create", "products:delete", "reports:sales", "customers:view"]) expect(can("inventory_staff", p)).toBe(false);
  });

  test("manager manages products, inventory, sales, customers, suppliers and reports", () => {
    for (const p of ["products:create", "products:delete", "inventory:adjust", "sales:create", "sales:cancel", "customers:update", "suppliers:manage", "reports:sales", "reports:profit"]) expect(can("manager", p)).toBe(true);
    for (const p of ["staff:manage", "billing:view", "settings:business"]) expect(can("manager", p)).toBe(false);
  });

  test("super admins have no tenant permissions and unknown permissions are denied", () => {
    expect(can("super_admin", "products:view")).toBe(false);
    expect(can("owner", "does:not-exist")).toBe(false);
    expect(can(undefined, "products:view")).toBe(false);
  });

  test("nobody can assign the owner role; admins cannot create admins", () => {
    expect(assignableRoles("owner")).not.toContain("owner");
    expect(assignableRoles("admin")).toEqual(["manager", "cashier", "inventory_staff"]);
    expect(assignableRoles("manager")).toEqual([]);
  });

  test("canManageUser blocks self-changes, cross-tenant targets and owner targets", () => {
    const t1 = "t1";
    const owner = { _id: "o", role: "owner", tenantId: t1 };
    const admin = { _id: "a", role: "admin", tenantId: t1 };
    const cashier = { _id: "c", role: "cashier", tenantId: t1 };
    const foreign = { _id: "x", role: "cashier", tenantId: "t2" };
    expect(canManageUser(owner, cashier)).toBe(true);
    expect(canManageUser(admin, cashier)).toBe(true);
    expect(canManageUser(admin, owner)).toBe(false);
    expect(canManageUser(admin, { _id: "a2", role: "admin", tenantId: t1 })).toBe(false);
    expect(canManageUser(owner, owner)).toBe(false);
    expect(canManageUser(owner, foreign)).toBe(false);
  });

  test("permissionsFor returns a list for UI rendering", () => {
    expect(permissionsFor("cashier")).toContain("pos:use");
    expect(permissionsFor("cashier")).not.toContain("billing:view");
  });
});
