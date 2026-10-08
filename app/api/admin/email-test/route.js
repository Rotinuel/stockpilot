import { z } from "zod";
import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { sendTestEmail } from "@/lib/email";
import { logAudit } from "@/services/audit";

const schema = z.object({ to: z.string().trim().toLowerCase().email("Enter a valid email address").max(160).optional() });

/** Super Admin: send a test email through the configured provider (defaults to your own address). */
export const POST = withApi(
  async ({ request, session }) => {
    const { to } = parse(schema, await readJson(request));
    const recipient = to || session.user.email;
    const result = await sendTestEmail(recipient);
    await logAudit({ userId: session.user._id, userName: session.user.name, role: "super_admin" }, "platform.email_test", {
      tenantId: null,
      metadata: { to: recipient, provider: result.provider, delivered: Boolean(result.delivered) },
      request,
    });
    return {
      delivered: Boolean(result.delivered),
      to: recipient,
      provider: result.provider,
      server: result.server,
      from: result.from,
      error: result.delivered ? null : result.error || "Email could not be sent.",
    };
  },
  { superAdmin: true, rateLimit: { limit: 10, windowMs: 10 * 60 * 1000 } },
);
