import { NextResponse } from "next/server";
import { clientIp, appUrl } from "@/lib/request";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { signPurposeToken } from "@/lib/auth/jwt";
import { isGoogleConfigured, createPkce, randomString, buildGoogleAuthUrl, OAUTH_STATE_COOKIE, oauthCookieOptions } from "@/lib/auth/google";

// GET /api/auth/google?mode=login|signup&next=/dashboard → redirects to Google's consent screen.
export async function GET(request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "signup" ? "signup" : "login";
  const back = mode === "signup" ? "/register" : "/login";
  if (!isGoogleConfigured()) return NextResponse.redirect(appUrl(`${back}?error=google_not_configured`));

  const limited = await rateLimit(`google-start:${clientIp(request)}`, RATE_LIMITS.auth);
  if (!limited.ok) return NextResponse.redirect(appUrl(`${back}?error=rate_limited`));

  const { verifier, challenge } = createPkce();
  const state = randomString();
  const nonce = randomString();
  const next = url.searchParams.get("next") || "";
  const token = await signPurposeToken({ state, verifier, nonce, next: next.slice(0, 200), mode }, { purpose: "oauth_state", expiresInSeconds: 600 });

  const res = NextResponse.redirect(buildGoogleAuthUrl({ state, codeChallenge: challenge, nonce }));
  res.cookies.set(OAUTH_STATE_COOKIE, token, oauthCookieOptions(600));
  return res;
}
