import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Tenant from "../models/Tenant.js";
import { sendNotificationEmail } from "../lib/email.js";
import { sendTenantWhatsApp } from "./whatsapp.js";

/**
 * Create an in-app notification (idempotent when dedupeKey is given).
 * Optionally emails the tenant's owner/admins.
 */
/** @param {object} p  whatsapp: true also sends the alert to the business WhatsApp number */
export async function notify({ tenantId, userId = null, roles = [], type = "system", severity = "info", title, message, link, dedupeKey, email = false, whatsapp = false }) {
  try {
    const doc = await Notification.create({ tenantId, userId, roles, type, severity, title, message, link, dedupeKey });
    // Only reached for NEW notifications (dedupe duplicates throw 11000 above), so WhatsApp is never spammed.
    if (whatsapp && tenantId) await sendTenantWhatsApp(tenantId, { title, message, type });
    if (email && tenantId) {
      const tenant = await Tenant.findById(tenantId).select("settings").lean();
      if (tenant?.settings?.emailNotifications !== false) {
        const recipients = await User.find({ tenantId, isActive: true, role: { $in: roles.length ? roles : ["owner", "admin"] } })
          .select("email")
          .lean();
        await Promise.all(recipients.map((r) => sendNotificationEmail({ to: r.email, title, message, link })));
      }
    }
    return doc;
  } catch (err) {
    if (err?.code === 11000) return null; // already notified (dedupe)
    console.error("[notify] failed", err?.message);
    return null;
  }
}

function visibilityFilter(ctx) {
  return {
    tenantId: ctx.tenantId,
    $and: [
      { $or: [{ userId: null }, { userId: ctx.userId }] },
      { $or: [{ roles: { $size: 0 } }, { roles: ctx.role }] },
    ],
  };
}

export async function listNotifications(ctx, { limit = 20, unreadOnly = false } = {}) {
  const filter = visibilityFilter(ctx);
  if (unreadOnly) filter.readBy = { $ne: ctx.userId };
  const [items, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
    Notification.countDocuments({ ...visibilityFilter(ctx), readBy: { $ne: ctx.userId } }),
  ]);
  return {
    unread,
    items: items.map((n) => ({
      id: String(n._id),
      type: n.type,
      severity: n.severity,
      title: n.title,
      message: n.message,
      link: n.link,
      createdAt: n.createdAt,
      read: (n.readBy || []).some((u) => String(u) === String(ctx.userId)),
    })),
  };
}

export async function markNotificationsRead(ctx, ids) {
  const filter = visibilityFilter(ctx);
  if (Array.isArray(ids) && ids.length) filter._id = { $in: ids };
  await Notification.updateMany(filter, { $addToSet: { readBy: ctx.userId } });
  return { ok: true };
}

/** Platform-wide announcement to every tenant. */
export async function broadcastAnnouncement({ title, message, severity = "info" }) {
  const tenants = await Tenant.find({}).select("_id").lean();
  const key = `announcement:${Date.now()}`;
  const docs = tenants.map((t) => ({ tenantId: t._id, type: "announcement", severity, title, message, dedupeKey: `${key}:${t._id}` }));
  if (docs.length) await Notification.insertMany(docs, { ordered: false });
  return { sent: docs.length };
}
