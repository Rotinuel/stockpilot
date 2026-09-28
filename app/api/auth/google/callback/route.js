import { NextResponse } from "next/server";
import { appUrl } from "@/lib/request";
import { verifyPurposeToken, signPurposeToken } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/cookies";
import { safeNext } from "@/lib/auth/redirects";
import { exchangeCodeForIdentity, OAUTH_STATE_COOKIE, GOOGLE_SIGNUP_COOKIE, oauthCookieOptions } from "@/lib/auth/google";
import { signInWithGoogle } from "@/services/auth";
import { getPlatformSettings } from "@/services/platform";

function fail(path, code) {
  const res = NextResponse.redirect(appUrl(`${path}?error=${encodeURIComponent(code)}`));
  res.cookies.set(OAUTH_STATE_COOKIE, "", oauthCookieOptions(0));
  return res;
}

// Google redirects here with ?code&state (or ?error=access_denied).
export async function GET(request) {
  const url = new URL(request.url);
  const saved = await verifyPurposeToken(request.cookies.get(OAUTH_STATE_COOKIE)?.value, "oauth_state");
  const back = saved?.mode === "signup" ? "/register" : "/login";

  if (url.searchParams.get("error")) return fail(back, "google_cancelled");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  // CSRF / login-fixation protection: state must match the signed, HTTP-only cookie we set.
  if (!saved || !code || !state || state !== saved.state) return fail(back, "google_state");

  try {
    const identity = await exchangeCodeForIdentity({ code, codeVerifier: saved.verifier, nonce: saved.nonce });
    const result = await signInWithGoogle(identity, request);

    if (result.status === "signed_in") {
      const res = NextResponse.redirect(appUrl(safeNext(saved.next, result.user.role)));
      res.cookies.set(OAUTH_STATE_COOKIE, "", oauthCookieOptions(0));
      return setSessionCookie(res, result.token);
    }

    // New person → finish sign-up (business details) on /register/google.
    const platform = await getPlatformSettings();
    if (!platform.allowRegistrations) return fail("/login", "registrations_closed");
    const pending = await signPurposeToken(
      { sub: identity.sub, email: identity.email, name: identity.name, picture: identity.picture },
      { purpose: "google_signup", expiresInSeconds: 1800 },
    );
    const res = NextResponse.redirect(appUrl("/register/google"));
    res.cookies.set(OAUTH_STATE_COOKIE, "", oauthCookieOptions(0));
    res.cookies.set(GOOGLE_SIGNUP_COOKIE, pending, oauthCookieOptions(1800));
    return res;
  } catch (err) {
    console.error("[google] callback error", err?.code || err?.message);
    return fail(back, err?.code ? String(err.code).toLowerCase() : "google_failed");
  }
}
