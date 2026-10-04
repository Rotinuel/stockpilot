import { NextResponse } from "next/server";
import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { unauthorized } from "@/lib/errors";
import { googleSignupSchema } from "@/lib/validators";
import { verifyPurposeToken } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/cookies";
import { REFERRAL_COOKIE } from "@/lib/referrals";
import { GOOGLE_SIGNUP_COOKIE, oauthCookieOptions } from "@/lib/auth/google";
import { registerBusiness } from "@/services/auth";

// Finish a Google sign-up: the identity comes from the signed cookie set by the
// callback (never from the request body); the form only supplies business details.
export const POST = withApi(
  async ({ request }) => {
    const pending = await verifyPurposeToken(request.cookies.get(GOOGLE_SIGNUP_COOKIE)?.value, "google_signup");
    if (!pending?.email || !pending?.sub) throw unauthorized("Your Google sign-up session expired. Please continue with Google again.");
    const data = parse(googleSignupSchema, await readJson(request));
    data.referralCode = data.referralCode || request.cookies.get(REFERRAL_COOKIE)?.value || undefined;
    const { token } = await registerBusiness({ ...data, email: pending.email, google: { sub: pending.sub, picture: pending.picture } }, request);
    const res = NextResponse.json({ ok: true, redirect: "/onboarding" }, { status: 201 });
    res.cookies.set(GOOGLE_SIGNUP_COOKIE, "", oauthCookieOptions(0));
    res.cookies.set(REFERRAL_COOKIE, "", { path: "/", maxAge: 0 });
    return setSessionCookie(res, token);
  },
  { auth: false, rateLimit: "register" },
);
