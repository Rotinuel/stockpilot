// WhatsApp Business Cloud API (Meta) client — server only.
// Business-initiated messages must use an APPROVED message template.
// Default template "stockpilot_alert" (category UTILITY), body e.g.:
//   "{{1}} — {{2}}"   with two text parameters (title, message).
// Without credentials, messages are logged to the console (development).
import { waDigits } from "./phone.js";

const API_VERSION = () => process.env.WHATSAPP_API_VERSION || "v21.0";

export function isWhatsAppConfigured() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

async function post(body) {
  const url = `https://graph.facebook.com/${API_VERSION()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.error_data?.details || json?.error?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.providerCode = json?.error?.code;
    throw err;
  }
  return { id: json?.messages?.[0]?.id || null };
}

const clip = (s, n) => {
  // Template parameters can't contain newlines/tabs or >4 consecutive spaces.
  const t = String(s ?? "").replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t || "-";
};

/**
 * Send a template message. params = array of body parameters (strings).
 * @returns {Promise<{status:'sent'|'logged', id?:string}>}
 */
export async function sendWhatsAppTemplate({ to, params = [], template, language }) {
  const name = template || process.env.WHATSAPP_TEMPLATE_NAME || "stockpilot_alert";
  const code = language || process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en";
  const digits = waDigits(to);
  if (!digits) throw new Error("Missing WhatsApp number");
  if (!isWhatsAppConfigured()) {
    console.info(`\n[whatsapp:dev] To: +${digits} · template ${name}\n[whatsapp:dev] ${params.join(" — ")}\n`);
    return { status: "logged" };
  }
  const { id } = await post({
    messaging_product: "whatsapp",
    to: digits,
    type: "template",
    template: {
      name,
      language: { code },
      components: [{ type: "body", parameters: params.map((p, i) => ({ type: "text", text: clip(p, i === 0 ? 120 : 900) })) }],
    },
  });
  return { status: "sent", id };
}
