// Plan limit helpers (pure). Limits of -1 (or null) mean "unlimited".

import { PLAN_FEATURE_LABELS, PLAN_LIMIT_LABELS } from "./constants.js";

export function isUnlimited(limit) {
  return limit === null || limit === undefined || Number(limit) < 0;
}

export function withinLimit(current, limit, adding = 1) {
  if (isUnlimited(limit)) return true;
  return Number(current) + Number(adding) <= Number(limit);
}

export function limitLabel(limit) {
  return isUnlimited(limit) ? "Unlimited" : Number(limit).toLocaleString("en-NG");
}

export function hasFeature(plan, feature) {
  return Boolean(plan?.features?.[feature]);
}

export function limitMessage(resource, limit) {
  const n = Number(limit).toLocaleString("en-NG");
  switch (resource) {
    case "products":
      return `You have reached your ${n}-product limit. Upgrade your plan to add more products.`;
    case "staffUsers":
      return `Your plan allows up to ${n} staff user${Number(limit) === 1 ? "" : "s"}. Upgrade your plan to invite more staff.`;
    case "locations":
      return `Your plan allows ${n} location${Number(limit) === 1 ? "" : "s"}. Upgrade to Professional for multi-location support.`;
    case "monthlyTransactions":
      return `You have reached your plan's limit of ${n} sales this month. Upgrade your plan to keep selling.`;
    default:
      return `You have reached your plan limit (${n}). Upgrade your plan to continue.`;
  }
}

export function featureMessage(feature) {
  const label = PLAN_FEATURE_LABELS[feature] || "This feature";
  return `${label} is not included in your current plan. Upgrade to unlock it.`;
}

/** Usage that exceeds a (lower) plan's limits — used to block downgrades. */
export function limitViolations(usage, plan) {
  const out = [];
  for (const key of Object.keys(PLAN_LIMIT_LABELS)) {
    if (key === "monthlyTransactions") continue;
    const limit = plan?.limits?.[key];
    if (!isUnlimited(limit) && Number(usage?.[key] || 0) > Number(limit)) {
      out.push({ key, label: PLAN_LIMIT_LABELS[key], usage: usage[key], limit });
    }
  }
  return out;
}

export function describePlanLimits(plan) {
  return Object.entries(PLAN_LIMIT_LABELS).map(([key, label]) => ({ key, label, value: limitLabel(plan?.limits?.[key]) }));
}
