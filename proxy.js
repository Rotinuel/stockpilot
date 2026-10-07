// Next.js 16 Proxy (formerly "middleware"). Runs before routes render.
// It performs an OPTIMISTIC check only (JWT signature/expiry) to redirect
// early; authoritative checks (user active, role, tenant, subscription) are
// done again server-side in every page (lib/session.js) and API (lib/api.js).
import { NextResponse } from "next/server";
import { verifySessionToken, signSessionToken } from "./lib/auth/jwt.js";
import { sessionCookieOptions } from "./lib/auth/cookies.js";
import { SESSION_COOKIE } from "./lib/constants.js";
import { REFERRAL_COOKIE, REFERRAL_COOKIE_DAYS, normalizeReferralCode } from "./lib/referrals.js";

// Signed-in users are sent to their dashboard from these pages. /login stays
// reachable so you can switch accounts (e.g. between demo roles).
const AUTH_PAGES = ["/register", "/forgot-password"];
const APP_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/products",
  "/inventory",
  "/pos",
  "/sales",
  "/purchases",
  "/customers",
  "/suppliers",
  "/expenses",
  "/reports",
  "/staff",
  "/locations",
  "/billing",
  "/referrals",
  "/settings",
  "/notifications",
  "/audit-logs",
];

const matches = (pathname, prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`);

export async function proxy(request) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isSuperArea = matches(pathname, "/super-admin");
  const isAppArea = APP_PREFIXES.some((p) => matches(pathname, p));

  if ((isSuperArea || isAppArea) && !session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    const res = NextResponse.redirect(url);
    if (token) res.cookies.delete(SESSION_COOKIE); // stale/invalid cookie
    return res;
  }

  if (isSuperArea && session?.role !== "super_admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isAppArea && session?.role === "super_admin") {
    return NextResponse.redirect(new URL("/super-admin", request.url));
  }

  // Signed-in people go straight to their workspace from the home page and sign-up pages.
  if (session && (pathname === "/" || AUTH_PAGES.some((p) => matches(pathname, p)))) {
    return withRenewedSession(NextResponse.redirect(new URL(session.role === "super_admin" ? "/super-admin" : "/dashboard", request.url)), session);
  }

  const res = NextResponse.next();
  if (isAppArea || isSuperArea) res.headers.set("Cache-Control", "private, no-store");
  if (session) await withRenewedSession(res, session);
  // Remember a referral link (?ref=CODE) for 30 days so it still counts if the visitor signs up later.
  const ref = !session ? normalizeReferralCode(request.nextUrl.searchParams.get("ref")) : null;
  if (ref) {
    res.cookies.set(REFERRAL_COOKIE, ref, {
      path: "/",
      maxAge: REFERRAL_COOKIE_DAYS * 24 * 3600,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}

// "Stay signed in": every visit at least 12 hours after the token was issued gets a fresh
// SESSION_DAYS (default 30) token, so people who use the app regularly are never logged out.
// (Revocation still works: the server re-checks the user's tokenVersion on every request.)
const RENEW_AFTER_SECONDS = 12 * 60 * 60;
async function withRenewedSession(res, session) {
  try {
    const age = Math.floor(Date.now() / 1000) - Number(session.iat || 0);
    if (age >= RENEW_AFTER_SECONDS && session.sub) {
      const token = await signSessionToken({ sub: session.sub, tid: session.tid, role: session.role, tv: session.tv });
      res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    }
  } catch {}
  return res;
}

export const config = {
  matcher: [
    // Pages only — skip API routes, Next internals and static files.
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|site.webmanifest|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|txt|xml)$).*)",
  ],
};
