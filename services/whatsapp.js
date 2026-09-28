import Tenant from "../models/Tenant.js";
import WhatsAppMessage from "../models/WhatsAppMessage.js";
import { sendWhatsAppTemplate } from "../lib/whatsapp.js";

/**
 * Send a WhatsApp alert to the business's WhatsApp number (the owner's number
 * captured at registration, editable in Settings). Never throws.
 */
export async function sendTenantWhatsApp(tenantId, { title, message, type = "system", force = false }) {
  try {
    const tenant = await Tenant.findById(tenantId).select("whatsappNumber businessName settings").lean();
    if (!tenant?.whatsappNumber) return { status: "skipped", reason: "no_number" };
    if (!force && tenant.settings?.whatsappNotifications === false) return { status: "skipped", reason: "disabled" };
    const params = [title, `${message} (${tenant.businessName})`];
    try {
      const r = await sendWhatsAppTemplate({ to: tenant.whatsappNumber, params });
      await WhatsAppMessage.create({ tenantId, to: tenant.whatsappNumber, template: process.env.WHATSAPP_TEMPLATE_NAME || "stockpilot_alert", notificationType: type, params, status: r.status, providerMessageId: r.id });
      return r;
    } catch (err) {
      console.error("[whatsapp] send failed", err?.message);
      await WhatsAppMessage.create({ tenantId, to: tenant.whatsappNumber, notificationType: type, params, status: "failed", error: String(err?.message || err).slice(0, 500) });
      return { status: "failed", error: err?.message };
    }
  } catch (err) {
    console.error("[whatsapp] unexpected", err?.message);
    return { status: "failed", error: err?.message };
  }
}

export async function recentWhatsAppMessages(tenantId, limit = 10) {
  return WhatsAppMessage.find({ tenantId }).sort({ createdAt: -1 }).limit(limit).lean();
}
