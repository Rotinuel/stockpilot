import { withApi } from "@/lib/api";
import { sendWhatsAppTest } from "@/services/tenant";
import { isWhatsAppConfigured } from "@/lib/whatsapp";

export const POST = withApi(async ({ ctx }) => ({ ...(await sendWhatsAppTest(ctx)), configured: isWhatsAppConfigured() }), {
  permission: "settings:business",
  rateLimit: { limit: 5, windowMs: 10 * 60 * 1000 },
});
