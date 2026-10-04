// Server-only: who invited the visitor on the sign-up pages (?ref=CODE or the sp_ref cookie).
import { cookies } from "next/headers";
import { REFERRAL_COOKIE, normalizeReferralCode } from "./referrals.js";
import { findReferrer } from "../services/referrals.js";

export async function signupReferral(searchParams) {
  try {
    const store = await cookies();
    const code = normalizeReferralCode(searchParams?.ref) || normalizeReferralCode(store.get(REFERRAL_COOKIE)?.value);
    if (!code) return null;
    const referrer = await findReferrer(code);
    return referrer ? { code, businessName: referrer.businessName } : null;
  } catch {
    return null;
  }
}
