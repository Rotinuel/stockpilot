// Tenant scoping helper. The tenantId ALWAYS comes from the server-side
// session context and is applied last so it can never be overridden.
import { notFound } from "../lib/errors.js";
import { isValidObjectId } from "../lib/db.js";

export function scoped(ctx, filter = {}) {
  if (!ctx?.tenantId) throw new Error("Tenant context missing — refusing unscoped query.");
  return { ...filter, tenantId: ctx.tenantId };
}

/** Validate an id and return a tenant-scoped filter for a single document. */
export function byId(ctx, id, extra = {}) {
  if (!isValidObjectId(String(id))) throw notFound();
  return scoped(ctx, { ...extra, _id: id });
}

export function sessionOpts(session) {
  return session ? { session } : {};
}
