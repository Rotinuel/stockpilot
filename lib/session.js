// Server-side session resolution for Server Components and Route Handlers.
// The JWT only proves identity; user status, role, tenant and subscription
// are ALWAYS re-read from MongoDB so revocations take effect immediately.
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connectDB } from "./db.js";
import { verifySessionToken } from "./auth/jwt.js";
import { SESSION_COOKIE } from "./constants.js";
import { computeAccess } from "./access.js";
import { can } from "./rbac.js";
import User from "../models/User.js";
import Tenant from "../models/Tenant.js";
import Location from "../models/Location.js";
import { getEffectivePlan } from "../services/plans.js";
import { getPlatformSettings } from "../services/platform.js";

async function loadSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload?.sub) return null;

  await connectDB();
  const user = await User.findById(payload.sub).lean();
  if (!user || !user.isActive) return null;
  if ((user.tokenVersion || 0) !== (payload.tv || 0)) return null; // revoked

  if (user.role === "super_admin") {
    return { user: sanitizeUser(user), isSuperAdmin: true, tenant: null, plan: null, access: null, ctx: null };
  }

  if (!user.tenantId) return null;
  const tenant = await Tenant.findById(user.tenantId).lean();
  if (!tenant) return null;

  const [plan, platform] = await Promise.all([getEffectivePlan(tenant), getPlatformSettings()]);
  const access = computeAccess(tenant, { graceDays: platform.gracePeriodDays });

  let locationId = user.defaultLocationId || null;
  if (!locationId) {
    const loc = await Location.findOne({ tenantId: tenant._id, isDefault: true }).select("_id").lean();
    locationId = loc?._id || null;
  }

  const ctx = {
    tenantId: tenant._id,
    userId: user._id,
    userName: user.name,
    role: user.role,
    settings: tenant.settings || {},
    currency: tenant.currency || "NGN",
    timezone: tenant.timezone || "Africa/Lagos",
    locationId,
    plan,
    access,
  };

  return { user: sanitizeUser(user), isSuperAdmin: false, tenant, plan, access, platform, ctx };
}

function sanitizeUser(user) {
  const { password, emailVerificationTokenHash, passwordResetTokenHash, failedLoginAttempts, lockedUntil, ...safe } = user;
  return safe;
}

/** Memoised per request. Returns null when not signed in. */
export const getSession = cache(loadSession);

/** For tenant pages: redirects to /login (or /super-admin) when appropriate. */
export async function requireTenantSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.isSuperAdmin) redirect("/super-admin");
  return session;
}

/** For /super-admin pages. */
export async function requireSuperAdminSession() {
  const session = await getSession();
  if (!session) redirect("/login?next=/super-admin");
  if (!session.isSuperAdmin) redirect("/dashboard");
  return session;
}

export function sessionCan(session, permission) {
  if (!session?.user) return false;
  return can(session.user.role, permission, session.tenant?.settings);
}

/** Minimal, serialisable view of the session for Client Components. */
export function clientSession(session) {
  if (!session) return null;
  const { user, tenant, plan, access } = session;
  return {
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar || "",
      emailVerified: Boolean(user.emailVerified),
    },
    tenant: tenant
      ? {
          id: String(tenant._id),
          businessName: tenant.businessName,
          logo: tenant.logo || "",
          currency: tenant.currency || "NGN",
          subscriptionStatus: tenant.subscriptionStatus,
          taxRate: tenant.settings?.taxRate || 0,
          taxLabel: tenant.settings?.taxLabel || "VAT",
        }
      : null,
    plan: plan ? { code: plan.code, name: plan.name, features: plan.features || {}, limits: plan.limits || {} } : null,
    access: access
      ? {
          state: access.state,
          canWrite: access.canWrite,
          daysLeft: access.daysLeft,
          severity: access.severity,
          message: access.message,
        }
      : null,
  };
}
