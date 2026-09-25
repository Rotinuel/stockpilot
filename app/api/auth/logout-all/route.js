import { NextResponse } from "next/server";
import { withApi } from "@/lib/api";
import { logoutEverywhere } from "@/services/auth";
import { setSessionCookie } from "@/lib/auth/cookies";

// Invalidates every other session (tokenVersion++) and re-issues this one.
export const POST = withApi(async ({ session }) => {
  const { token } = await logoutEverywhere(session.user._id);
  return setSessionCookie(NextResponse.json({ ok: true, message: "Signed out of all other devices." }), token);
}, { anyUser: true });
