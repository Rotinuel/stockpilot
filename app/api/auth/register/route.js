import { NextResponse } from "next/server";
import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { registerSchema } from "@/lib/validators";
import { registerBusiness } from "@/services/auth";
import { setSessionCookie } from "@/lib/auth/cookies";

export const POST = withApi(
  async ({ request }) => {
    const data = parse(registerSchema, await readJson(request));
    const { token, tenant } = await registerBusiness(data, request);
    const res = NextResponse.json({ ok: true, redirect: "/onboarding", tenant: { id: String(tenant._id), businessName: tenant.businessName, trialEndsAt: tenant.trialEndsAt } }, { status: 201 });
    return setSessionCookie(res, token);
  },
  { auth: false, rateLimit: "register" },
);
