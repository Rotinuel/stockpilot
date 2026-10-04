// Role-based access control. Pure module (no DB) so it can be used by
// server code, client UI (to hide controls) and unit tests.
// IMPORTANT: hiding UI is cosmetic — every API route calls `can()` server-side.

const ALL = ["owner", "admin", "manager", "cashier", "inventory_staff"];
const OWNER_ADMIN = ["owner", "admin"];
const MANAGEMENT = ["owner", "admin", "manager"];

export const PERMISSIONS = {
  "dashboard:view": ALL,
  "dashboard:financials": MANAGEMENT,

  "products:view": ALL,
  "products:create": MANAGEMENT,
  "products:update": MANAGEMENT,
  "products:delete": MANAGEMENT,
  "products:import": MANAGEMENT,
  "products:export": MANAGEMENT,
  "products:view_cost": ["owner", "admin", "manager", "inventory_staff"],

  "categories:manage": MANAGEMENT,

  "inventory:view": ["owner", "admin", "manager", "inventory_staff"],
  "inventory:adjust": ["owner", "admin", "manager", "inventory_staff"],
  "inventory:transfer": ["owner", "admin", "manager", "inventory_staff"],

  "pos:use": ["owner", "admin", "manager", "cashier"],
  "sales:view": ["owner", "admin", "manager", "cashier"],
  "sales:create": ["owner", "admin", "manager", "cashier"],
  "sales:cancel": MANAGEMENT,
  "sales:view_all": MANAGEMENT, // cashiers only see their own sales

  "purchases:view": MANAGEMENT,
  "purchases:create": MANAGEMENT,
  "purchases:cancel": OWNER_ADMIN,

  "customers:view": ["owner", "admin", "manager", "cashier"],
  "customers:create": ["owner", "admin", "manager", "cashier"],
  "customers:update": MANAGEMENT,
  "customers:delete": OWNER_ADMIN,
  "customers:payments": MANAGEMENT,

  "suppliers:view": MANAGEMENT,
  "suppliers:manage": MANAGEMENT,
  "suppliers:delete": OWNER_ADMIN,
  "suppliers:payments": MANAGEMENT,

  "expenses:view": OWNER_ADMIN,
  "expenses:manage": OWNER_ADMIN,

  "reports:view": ["owner", "admin", "manager", "inventory_staff"],
  "reports:sales": MANAGEMENT,
  "reports:inventory": ["owner", "admin", "manager", "inventory_staff"],
  "reports:profit": MANAGEMENT,
  "reports:expenses": OWNER_ADMIN,
  "reports:customers": MANAGEMENT,

  "staff:view": OWNER_ADMIN,
  "staff:manage": OWNER_ADMIN,

  "locations:view": MANAGEMENT,
  "locations:manage": OWNER_ADMIN,

  "billing:view": OWNER_ADMIN,
  "billing:manage": ["owner"],

  "referrals:view": OWNER_ADMIN,
  "referrals:manage": ["owner"],

  "settings:business": OWNER_ADMIN,
  "audit:view": OWNER_ADMIN,
};

// Permissions a tenant owner can optionally grant to cashiers in Settings.
export const CASHIER_OPTIONAL = {
  allowCashierReports: ["reports:view", "reports:sales"],
};

/**
 * @param {string} role
 * @param {string} permission
 * @param {object} [tenantSettings]
 */
export function can(role, permission, tenantSettings) {
  if (!role || !permission) return false;
  if (role === "super_admin") return false; // super admins use the /super-admin area only
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  if (allowed.includes(role)) return true;
  if (role === "cashier" && tenantSettings) {
    for (const [flag, perms] of Object.entries(CASHIER_OPTIONAL)) {
      if (tenantSettings[flag] && perms.includes(permission)) return true;
    }
  }
  return false;
}

export function permissionsFor(role, tenantSettings) {
  return Object.keys(PERMISSIONS).filter((p) => can(role, p, tenantSettings));
}

const ROLE_RANK = { owner: 5, admin: 4, manager: 3, inventory_staff: 2, cashier: 2 };

/** Roles an actor may assign to other staff. Nobody can create another owner. */
export function assignableRoles(actorRole) {
  if (actorRole === "owner") return ["admin", "manager", "cashier", "inventory_staff"];
  if (actorRole === "admin") return ["manager", "cashier", "inventory_staff"];
  return [];
}

/** Whether `actor` may modify the account of `target` (role change / deactivate). */
export function canManageUser(actor, target) {
  if (!actor || !target) return false;
  if (String(actor._id) === String(target._id)) return false; // no self-demotion/lockout
  if (String(actor.tenantId) !== String(target.tenantId)) return false;
  if (target.role === "owner") return false;
  if (actor.role === "owner") return true;
  if (actor.role === "admin") return (ROLE_RANK[target.role] || 0) < ROLE_RANK.admin;
  return false;
}
