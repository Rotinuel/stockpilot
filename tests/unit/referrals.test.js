import { describe, expect, test } from "bun:test";
import { normalizeReferralCode, codePrefix, buildReferralCode, commissionFor, rewardParts, describeReward, REFERRAL_ALPHABET } from "../../lib/referrals.js";
import { can } from "../../lib/rbac.js";

describe("referral codes", () => {
  test("normalizes and validates codes", () => {
    expect(normalizeReferralCode(" mamademo ")).toBe("MAMADEMO");
    expect(normalizeReferralCode("ab")).toBeNull();
    expect(normalizeReferralCode("bad code!")).toBeNull();
    expect(normalizeReferralCode(null)).toBeNull();
    expect(normalizeReferralCode("x".repeat(17))).toBeNull();
  });
  test("builds readable codes from the business name", () => {
    expect(codePrefix("Mama Put Stores")).toBe("MAMA");
    expect(codePrefix("123 !!")).toBe("SP");
    expect(codePrefix("Oil & Lily")).not.toMatch(/[OIL]/);
    const code = buildReferralCode("MAMA", [0, 1, 2, 255]);
    expect(code).toMatch(/^MAMA[A-Z2-9]{4}$/);
    expect(normalizeReferralCode(code)).toBe(code);
    for (const ch of code.slice(4)) expect(REFERRAL_ALPHABET).toContain(ch);
  });
});

describe("referral rewards", () => {
  test("commission is a percentage rounded to kobo", () => {
    expect(commissionFor(10000, 10)).toBe(1000);
    expect(commissionFor(5000, 7.5)).toBe(375);
    expect(commissionFor(3333, 3)).toBe(99.99);
    expect(commissionFor(0, 10)).toBe(0);
  });
  test("reward parts follow the reward type", () => {
    expect(rewardParts({ rewardType: "days", rewardDays: 30, commissionPercent: 10 })).toEqual({ days: 30, percent: 0 });
    expect(rewardParts({ rewardType: "commission", rewardDays: 30, commissionPercent: 10 })).toEqual({ days: 0, percent: 10 });
    expect(rewardParts({ rewardType: "both", rewardDays: 14, commissionPercent: 5 })).toEqual({ days: 14, percent: 5 });
    expect(describeReward({ rewardType: "both", rewardDays: 30, commissionPercent: 10 })).toBe("30 free days on your subscription and 10% of their first payment in cash");
  });
  test("only owners and admins see referrals; only owners edit payout details", () => {
    expect(can("owner", "referrals:view")).toBe(true);
    expect(can("admin", "referrals:view")).toBe(true);
    expect(can("cashier", "referrals:view")).toBe(false);
    expect(can("admin", "referrals:manage")).toBe(false);
    expect(can("owner", "referrals:manage")).toBe(true);
  });
});
