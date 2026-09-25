import { NextResponse } from "next/server";
import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { acceptInviteSchema } from "@/lib/validators";
import { acceptInvitation } from "@/services/auth";
import { setSessionCookie } from "@/lib/auth/cookies";

export const POST = withApi(
  async ({ request }) => {
    const data = parse(acceptInviteSchema, await readJson(request));
    const { user, token } = await acceptInvitation(data, request);
    const res = NextResponse.json({ ok: true, redirect: user.role === "cashier" ? "/pos" : "/dashboard" }, { status: 201 });
    return setSessionCookie(res, token);
  },
  { auth: false, rateLimit: "register" },
);
