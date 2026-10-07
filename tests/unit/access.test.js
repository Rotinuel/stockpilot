import { describe, expect, test } from "bun:test";
import { computeAccess, trialWindow, dueTrialReminder, addDays, DAY_MS } from "../../lib/access.js";
import { TRIAL_DAYS } from "../../lib/constants.js";

const now = new Date("2026-09-25T10:00:00Z");
const trialTenant = (daysLeft) => ({ status: "active", subscriptionStatus: "trialing", trialEndsAt: new Date(now.getTime() + daysLeft * DAY_MS) });

describe("3-day trial", () => {
  test("trial is exactly 3 days", () => {
    expect(TRIAL_DAYS).toBe(3);
    const { trialStartedAt, trialEndsAt } = trialWindow(now);
    expect(trialEndsAt.getTime() - trialStartedAt.getTime()).toBe(3 * DAY_MS);
  });

  test("active trial allows writes and reports days left", () => {
    const a = computeAccess(trialTenant(4), { now });
    expect(a.state).toBe("trialing");
    expect(a.canWrite).toBe(true);
    expect(a.daysLeft).toBe(4);
    expect(a.message).toBe("Your free trial ends in 4 days.");
  });

  test("severity escalates at 5 → info, 3 → warning, 1 → urgent", () => {
    expect(computeAccess(trialTenant(5), { now }).severity).toBe("info");
    expect(computeAccess(trialTenant(3), { now }).severity).toBe("warning");
    expect(computeAccess(trialTenant(1), { now }).severity).toBe("urgent");
  });

  test("expired trial is read-only but data remains readable", () => {
    const a = computeAccess(trialTenant(-0.01), { now });
    expect(a.state).toBe("trial_expired");
    expect(a.effectiveStatus).toBe("expired");
    expect(a.canRead).toBe(true);
    expect(a.canWrite).toBe(false);
  });

  test("reminder keys are due once each", () => {
    expect(dueTrialReminder(trialTenant(2.5), now)).toBe(null);
    expect(dueTrialReminder(trialTenant(1.5), now)).toBe("trial-2");
    expect(dueTrialReminder({ ...trialTenant(0.5), remindersSent: ["trial-2"] }, now)).toBe("trial-1");
    expect(dueTrialReminder({ ...trialTenant(0.5), remindersSent: ["trial-2", "trial-1"] }, now)).toBe(null);
    expect(dueTrialReminder(trialTenant(-1), now)).toBe("trial-expired");
  });
});

describe("Paid subscription lifecycle", () => {
  const base = { status: "active", subscriptionStatus: "active" };

  test("active within period → full access", () => {
    const a = computeAccess({ ...base, subscriptionEndDate: addDays(now, 10) }, { now });
    expect(a.state).toBe("active");
    expect(a.canWrite).toBe(true);
  });

  test("active but renewal not confirmed → implicit grace period", () => {
    const a = computeAccess({ ...base, subscriptionEndDate: addDays(now, -1) }, { now, graceDays: 3 });
    expect(a.state).toBe("past_due");
    expect(a.inGrace).toBe(true);
    expect(a.canWrite).toBe(true);
  });

  test("past_due within grace keeps access; after grace becomes read-only", () => {
    expect(computeAccess({ ...base, subscriptionStatus: "past_due", graceEndsAt: addDays(now, 2) }, { now }).canWrite).toBe(true);
    const after = computeAccess({ ...base, subscriptionStatus: "past_due", graceEndsAt: addDays(now, -1) }, { now });
    expect(after.canWrite).toBe(false);
    expect(after.canRead).toBe(true);
    expect(after.state).toBe("expired");
  });

  test("cancelled keeps access until period end, then expires", () => {
    expect(computeAccess({ ...base, subscriptionStatus: "cancelled", subscriptionEndDate: addDays(now, 5) }, { now }).canWrite).toBe(true);
    expect(computeAccess({ ...base, subscriptionStatus: "cancelled", subscriptionEndDate: addDays(now, -5) }, { now }).canWrite).toBe(false);
  });

  test("suspended tenants cannot read or write", () => {
    const a = computeAccess({ ...base, status: "suspended", subscriptionEndDate: addDays(now, 10) }, { now });
    expect(a.state).toBe("suspended");
    expect(a.canRead).toBe(false);
    expect(a.canWrite).toBe(false);
  });
});

import { isLegacyTrial } from "../../lib/access.js";
describe("old 7-day trials", () => {
  const start = new Date("2026-09-20T10:00:00Z");
  test("only untouched 7-day trials are shortened", () => {
    expect(isLegacyTrial({ subscriptionStatus: "trialing", trialStartedAt: start, trialEndsAt: addDays(start, 7) })).toBe(true);
    expect(isLegacyTrial({ subscriptionStatus: "trialing", trialStartedAt: start, trialEndsAt: addDays(start, 3) })).toBe(false);
    expect(isLegacyTrial({ subscriptionStatus: "trialing", trialStartedAt: start, trialEndsAt: addDays(start, 37) })).toBe(false); // extended
    expect(isLegacyTrial({ subscriptionStatus: "active", trialStartedAt: start, trialEndsAt: addDays(start, 7) })).toBe(false);
  });
});
