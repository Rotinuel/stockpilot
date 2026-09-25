// Next.js 16 Proxy (formerly "middleware"). Runs before routes render.
// It performs an OPTIMISTIC check only (JWT signature/expiry) to redirect
// early; authoritative checks (user active, role, tenant, subscription) are
// done again server-side in every page (lib/session.js) and API (lib/api.js).
import { NextResponse } from "next/server";
import { verifySessionToken } from "./lib/auth/jwt.js";
import { SESSION_COOKIE } from "./lib/constants.js";

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

  if (session && AUTH_PAGES.some((p) => matches(pathname, p))) {
    return NextResponse.redirect(new URL(session.role === "super_admin" ? "/super-admin" : "/dashboard", request.url));
  }

  const res = NextResponse.next();
  if (isAppArea || isSuperArea) res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = {
  matcher: [
    // Pages only — skip API routes, Next internals and static files.
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|site.webmanifest|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|txt|xml)$).*)",
  ],
};
