import AuditLog from "../models/AuditLog.js";

/**
 * Record an audit event. Never throws (auditing must not break the action).
 * @param {object} actor ctx ({tenantId,userId,userName,role}) or session-like object
 */
export async function logAudit(actor, action, { entity, entityId, metadata, request, tenantId } = {}) {
  try {
    await AuditLog.create({
      tenantId: tenantId !== undefined ? tenantId : actor?.tenantId || null,
      userId: actor?.userId || actor?._id || null,
      userName: actor?.userName || actor?.name,
      userRole: actor?.role,
      action,
      entity,
      entityId,
      metadata: metadata || {},
      ip: request?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() || request?.headers?.get?.("x-real-ip") || undefined,
      userAgent: request?.headers?.get?.("user-agent")?.slice(0, 250) || undefined,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("[audit] failed to record", action, err?.message);
  }
}

export async function listAuditLogs(filter, { page = 1, limit = 30 } = {}) {
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}
