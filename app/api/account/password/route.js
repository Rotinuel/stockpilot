import { NextResponse } from "next/server";
import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { changePasswordSchema } from "@/lib/validators";
import { changePassword } from "@/services/auth";
import { setSessionCookie } from "@/lib/auth/cookies";

export const POST = withApi(
  async ({ request, session }) => {
    const data = parse(changePasswordSchema, await readJson(request));
    const { token } = await changePassword(session.user._id, data, request);
    return setSessionCookie(NextResponse.json({ ok: true, message: "Password updated. Other devices have been signed out." }), token);
  },
  { rateLimit: "auth", anyUser: true },
);
