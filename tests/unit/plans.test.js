import { describe, expect, test } from "bun:test";
import { isUnlimited, withinLimit, limitMessage, limitViolations, hasFeature } from "../../lib/plans.js";
import { reportAccess } from "../../lib/report-access.js";

const starter = { name: "Starter", limits: { products: 500, staffUsers: 2, locations: 1, monthlyTransactions: -1 }, features: { expenses: true } };
const professional = { name: "Professional", limits: { products: -1, staffUsers: -1, locations: -1 }, features: { export: true, profitAnalysis: true, advancedReports: true, expenses: true, auditLogs: true } };

describe("Plan limits", () => {
  test("unlimited is -1/null/undefined", () => {
    expect(isUnlimited(-1)).toBe(true);
    expect(isUnlimited(null)).toBe(true);
    expect(isUnlimited(500)).toBe(false);
  });

  test("the 500th product is allowed, the 501st is not", () => {
    expect(withinLimit(499, 500)).toBe(true);
    expect(withinLimit(500, 500)).toBe(false);
    expect(withinLimit(1_000_000, -1)).toBe(true);
  });

  test("limit message matches product copy", () => {
    expect(limitMessage("products", 500)).toBe("You have reached your 500-product limit. Upgrade your plan to add more products.");
  });

  test("downgrade violations are detected", () => {
    const v = limitViolations({ products: 800, staffUsers: 1, locations: 1 }, starter);
    expect(v.map((x) => x.key)).toEqual(["products"]);
    expect(limitViolations({ products: 800, staffUsers: 20, locations: 3 }, professional)).toEqual([]);
  });

  test("feature flags", () => {
    expect(hasFeature(starter, "export")).toBe(false);
    expect(hasFeature(professional, "export")).toBe(true);
  });

  test("report access combines role and plan", () => {
    expect(reportAccess("owner", {}, starter, "sales").allowed).toBe(true);
    expect(reportAccess("owner", {}, starter, "profit")).toEqual({ allowed: false, reason: "plan", feature: "profitAnalysis" });
    expect(reportAccess("cashier", {}, professional, "profit")).toEqual({ allowed: false, reason: "role" });
    expect(reportAccess("inventory_staff", {}, professional, "inventory").allowed).toBe(true);
  });
});
