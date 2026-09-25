// Which report types a user may open, given their role and their tenant's plan.
import { can } from "./rbac.js";
import { hasFeature } from "./plans.js";

export const REPORT_TYPES = [
  { key: "sales", label: "Sales", permission: "reports:sales", feature: null },
  { key: "inventory", label: "Inventory", permission: "reports:inventory", feature: null },
  { key: "profit", label: "Profit & Loss", permission: "reports:profit", feature: "profitAnalysis" },
  { key: "expenses", label: "Expenses", permission: "reports:expenses", feature: "expenses" },
  { key: "customers", label: "Customers", permission: "reports:customers", feature: "advancedReports" },
];

/** @returns {{allowed:boolean, reason?:'role'|'plan', feature?:string}} */
export function reportAccess(role, tenantSettings, plan, type) {
  const def = REPORT_TYPES.find((r) => r.key === type);
  if (!def) return { allowed: false, reason: "role" };
  if (!can(role, def.permission, tenantSettings)) return { allowed: false, reason: "role" };
  if (def.feature && !hasFeature(plan, def.feature)) return { allowed: false, reason: "plan", feature: def.feature };
  return { allowed: true };
}
