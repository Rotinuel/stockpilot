import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { verifyPaymentSchema } from "@/lib/validators";
import { verifyAndApply } from "@/services/billing";

// Server-side verification with Paystack. The browser only supplies the reference.
export const POST = withApi(
  async ({ request, ctx }) => {
    const { reference } = parse(verifyPaymentSchema, await readJson(request));
    const result = await verifyAndApply(reference, { expectedTenantId: ctx.tenantId, via: "callback" });
    return { status: result.status, plan: result.plan, periodEnd: result.periodEnd };
  },
  { permission: "billing:view", rateLimit: "checkout" },
);
