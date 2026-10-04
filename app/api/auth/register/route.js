import { NextResponse } from "next/server";
import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { registerSchema } from "@/lib/validators";
import { registerBusiness } from "@/services/auth";
import { setSessionCookie } from "@/lib/auth/cookies";
import { REFERRAL_COOKIE } from "@/lib/referrals";

export const POST = withApi(
  async ({ request }) => {
    const data = parse(registerSchema, await readJson(request));
    // Referral: from the form, or the cookie set when the visitor opened a ?ref= link.
    data.referralCode = data.referralCode || request.cookies.get(REFERRAL_COOKIE)?.value || undefined;
    const { token, tenant } = await registerBusiness(data, request);
    const res = NextResponse.json({ ok: true, redirect: "/onboarding", tenant: { id: String(tenant._id), businessName: tenant.businessName, trialEndsAt: tenant.trialEndsAt } }, { status: 201 });
    res.cookies.set(REFERRAL_COOKIE, "", { path: "/", maxAge: 0 });
    return setSessionCookie(res, token);
  },
  { auth: false, rateLimit: "register" },
);
