// Route handler wrapper. Every API endpoint goes through withApi(), which enforces:
//   1. Authentication (session from HTTP-only cookie, re-validated against DB)
//   2. Role permission (RBAC)
//   3. Tenant scoping (ctx.tenantId comes from the session — never from the client)
//   4. Subscription access (read-only when trial/subscription has lapsed)
//   5. Plan feature gates
// plus CSRF origin checks, rate limiting and safe error responses.
import { NextResponse } from "next/server";
import { ApiError, forbidden, normalizeError, paymentRequired, tooManyRequests, unauthorized } from "./errors.js";
import { assertSameOrigin, clientIp } from "./request.js";
import { rateLimit as hit, RATE_LIMITS } from "./rate-limit.js";
import { can } from "./rbac.js";
import { hasFeature, featureMessage } from "./plans.js";
import { getSession } from "./session.js";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * @param {(args:{request:Request, params:object, session:object|null, ctx:object|null, searchParams:URLSearchParams}) => Promise<any>} handler
 * @param {{
 *   auth?: boolean, superAdmin?: boolean, anyUser?: boolean, permission?: string|string[],
 *   write?: boolean, feature?: string, csrf?: boolean,
 *   rateLimit?: keyof typeof RATE_LIMITS | {limit:number, windowMs:number}, rateKey?: string
 * }} [options]
 */
export function withApi(handler, options = {}) {
  const { auth = true, superAdmin = false, anyUser = false, permission, write = false, feature, csrf = true } = options;

  return async function route(request, context) {
    try {
      if (csrf && MUTATING.has(request.method)) assertSameOrigin(request);

      if (options.rateLimit) {
        const cfg = typeof options.rateLimit === "string" ? RATE_LIMITS[options.rateLimit] : options.rateLimit;
        const key = `${options.rateKey || new URL(request.url).pathname}:${clientIp(request)}`;
        const res = await hit(key, cfg);
        if (!res.ok) throw tooManyRequests();
      }

      let session = null;
      if (auth) {
        session = await getSession();
        if (!session) throw unauthorized();

        if (superAdmin) {
          if (!session.isSuperAdmin) throw forbidden();
        } else if (!anyUser) {
          if (session.isSuperAdmin || !session.tenant) throw forbidden("This endpoint is only available to business accounts.");
          if (session.access?.state === "suspended") {
            throw forbidden("This business account has been suspended. Please contact support.", "TENANT_SUSPENDED");
          }
          const perms = Array.isArray(permission) ? permission : permission ? [permission] : [];
          for (const p of perms) {
            if (!can(session.user.role, p, session.tenant.settings)) throw forbidden();
          }
          if (write && !session.access?.canWrite) {
            throw paymentRequired(session.access?.message || "An active subscription is required for this action.");
          }
          if (feature && !hasFeature(session.plan, feature)) {
            throw new ApiError(403, featureMessage(feature), "PLAN_FEATURE");
          }
        }
      }

      const params = context?.params ? await context.params : {};
      const searchParams = new URL(request.url).searchParams;
      const result = await handler({ request, params, session, ctx: session?.ctx || null, searchParams });

      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err) {
  const known = normalizeError(err);
  if (known) {
    return NextResponse.json(
      { error: { message: known.message, code: known.code, details: known.details } },
      { status: known.status },
    );
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json(
    { error: { message: "Something went wrong on our side. Please try again.", code: "INTERNAL" } },
    { status: 500 },
  );
}

/** Parse & validate with a zod schema (throws a 422 on failure). */
export function parse(schema, data) {
  return schema.parse(data);
}

/** Parse pagination params from a URLSearchParams. */
export function pagination(searchParams, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(searchParams.get("limit") || String(defaultLimit), 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}
