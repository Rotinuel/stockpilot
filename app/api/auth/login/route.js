import { NextResponse } from "next/server";
import { withApi, parse } from "@/lib/api";
import { readJson, clientIp } from "@/lib/request";
import { tooManyRequests } from "@/lib/errors";
import { isLimited, recordHit, RATE_LIMITS } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validators";
import { login } from "@/services/auth";
import { setSessionCookie } from "@/lib/auth/cookies";

function safeNext(next, role) {
  const fallback = role === "super_admin" ? "/super-admin" : "/dashboard";
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/api")) return fallback;
  if (role === "super_admin" && !next.startsWith("/super-admin")) return fallback;
  if (role !== "super_admin" && next.startsWith("/super-admin")) return fallback;
  return next;
}

export const POST = withApi(
  async ({ request }) => {
    const body = await readJson(request);
    const data = parse(loginSchema, body);
    // Brute-force protection: only failed attempts count, per IP (plus per-account lockout in services/auth.js).
    const key = `login-fail:${clientIp(request)}`;
    if ((await isLimited(key, RATE_LIMITS.loginFailures)).limited) {
      throw tooManyRequests("Too many failed sign-in attempts from this network. Please wait 15 minutes or reset your password.");
    }
    let result;
    try {
      result = await login(data, request);
    } catch (err) {
      if (err?.status === 401) await recordHit(key, RATE_LIMITS.loginFailures);
      throw err;
    }
    const { user, token } = result;
    const res = NextResponse.json({ ok: true, redirect: safeNext(body.next, user.role) });
    return setSessionCookie(res, token);
  },
  { auth: false },
);
