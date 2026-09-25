// Subscription access rules. Pure and deterministic (pass `now` in tests).
//
// Lifecycle: trialing → (trial ends) expired → (pays) active → (renewal fails)
// past_due → (grace period ends) expired/read-only.  Data is never deleted.

import { DEFAULT_GRACE_DAYS, TRIAL_DAYS } from "./constants.js";

export const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date, days) {
  return new Date(new Date(date).getTime() + days * DAY_MS);
}

/** Trial window for a registration at `startedAt`: exactly TRIAL_DAYS long. */
export function trialWindow(startedAt = new Date()) {
  const start = new Date(startedAt);
  return { trialStartedAt: start, trialEndsAt: addDays(start, TRIAL_DAYS) };
}

export function daysLeft(until, now = new Date()) {
  if (!until) return 0;
  const ms = new Date(until).getTime() - new Date(now).getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / DAY_MS);
}

function fmtDate(d) {
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return String(d);
  }
}

function trialSeverity(days) {
  if (days <= 1) return "urgent";
  if (days <= 3) return "warning";
  return "info";
}

/**
 * Compute what a tenant may do right now.
 * @returns {{
 *   state: string, effectiveStatus: string, canRead: boolean, canWrite: boolean,
 *   daysLeft: number, severity: 'info'|'warning'|'urgent'|'danger'|null,
 *   message: string|null, inGrace: boolean, graceEndsAt: Date|null, endsAt: Date|null
 * }}
 */
export function computeAccess(tenant, { now = new Date(), graceDays = DEFAULT_GRACE_DAYS } = {}) {
  const base = {
    state: "none",
    effectiveStatus: tenant?.subscriptionStatus || "expired",
    canRead: true,
    canWrite: false,
    daysLeft: 0,
    severity: null,
    message: null,
    inGrace: false,
    graceEndsAt: null,
    endsAt: null,
  };
  if (!tenant) return { ...base, canRead: false };

  if (tenant.status === "suspended") {
    return {
      ...base,
      state: "suspended",
      canRead: false,
      severity: "danger",
      message: "This business account has been suspended. Please contact support.",
    };
  }

  const nowMs = new Date(now).getTime();
  const status = tenant.subscriptionStatus;

  if (status === "trialing") {
    const end = tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : null;
    if (end && end.getTime() > nowMs) {
      const d = daysLeft(end, now);
      const hours = Math.ceil((end.getTime() - nowMs) / 3_600_000);
      return {
        ...base,
        state: "trialing",
        effectiveStatus: "trialing",
        canWrite: true,
        daysLeft: d,
        endsAt: end,
        severity: trialSeverity(d),
        message:
          hours < 24
            ? `Your free trial ends in ${hours} hour${hours === 1 ? "" : "s"}.`
            : `Your free trial ends in ${d} day${d === 1 ? "" : "s"}.`,
      };
    }
    return {
      ...base,
      state: "trial_expired",
      effectiveStatus: "expired",
      endsAt: end,
      severity: "danger",
      message: "Your free trial has ended. Subscribe to keep adding sales, products and stock. Your data is safe.",
    };
  }

  const periodEnd = tenant.subscriptionEndDate ? new Date(tenant.subscriptionEndDate) : null;

  if (status === "active") {
    if (!periodEnd || periodEnd.getTime() > nowMs) {
      return { ...base, state: "active", effectiveStatus: "active", canWrite: true, endsAt: periodEnd, daysLeft: daysLeft(periodEnd, now) };
    }
    // Renewal not confirmed yet → implicit grace period.
    const graceEndsAt = addDays(periodEnd, graceDays);
    if (graceEndsAt.getTime() > nowMs) {
      return {
        ...base,
        state: "past_due",
        effectiveStatus: "past_due",
        canWrite: true,
        inGrace: true,
        graceEndsAt,
        endsAt: periodEnd,
        daysLeft: daysLeft(graceEndsAt, now),
        severity: "warning",
        message: `We couldn't confirm your renewal. Update your payment before ${fmtDate(graceEndsAt)} to avoid interruption.`,
      };
    }
    return expired(base, periodEnd);
  }

  if (status === "past_due") {
    const graceEndsAt = tenant.graceEndsAt
      ? new Date(tenant.graceEndsAt)
      : addDays(periodEnd || tenant.pastDueSince || now, graceDays);
    if (graceEndsAt.getTime() > nowMs) {
      return {
        ...base,
        state: "past_due",
        effectiveStatus: "past_due",
        canWrite: true,
        inGrace: true,
        graceEndsAt,
        endsAt: periodEnd,
        daysLeft: daysLeft(graceEndsAt, now),
        severity: "urgent",
        message: `Your last payment failed. You have until ${fmtDate(graceEndsAt)} to update your payment before your account becomes read-only.`,
      };
    }
    return expired(base, periodEnd, "Your grace period has ended. Renew your subscription to continue. Your data is safe.");
  }

  if (status === "cancelled") {
    if (periodEnd && periodEnd.getTime() > nowMs) {
      return {
        ...base,
        state: "cancelled",
        effectiveStatus: "cancelled",
        canWrite: true,
        endsAt: periodEnd,
        daysLeft: daysLeft(periodEnd, now),
        severity: "info",
        message: `Your subscription is cancelled and remains available until ${fmtDate(periodEnd)}.`,
      };
    }
    return expired(base, periodEnd);
  }

  return expired(base, periodEnd);
}

function expired(base, periodEnd, message) {
  return {
    ...base,
    state: "expired",
    effectiveStatus: "expired",
    endsAt: periodEnd,
    severity: "danger",
    message: message || "Your subscription has expired. Subscribe to continue recording sales and stock. Your data is safe.",
  };
}

/** Which trial reminder (if any) is due. Returns a key like "trial-3". */
export function dueTrialReminder(tenant, now = new Date()) {
  if (tenant?.subscriptionStatus !== "trialing" || !tenant.trialEndsAt) return null;
  const end = new Date(tenant.trialEndsAt).getTime();
  const nowMs = new Date(now).getTime();
  if (end <= nowMs) return "trial-expired";
  const d = daysLeft(end, now);
  const sent = new Set(tenant.remindersSent || []);
  for (const mark of [1, 3, 5]) {
    if (d <= mark && !sent.has(`trial-${mark}`)) return `trial-${mark}`;
  }
  return null;
}
