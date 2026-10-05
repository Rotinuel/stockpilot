import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { checkoutSchema } from "@/lib/validators";
import { startCheckout } from "@/services/billing";

// Deliberately NOT `write: true` — expired tenants must be able to pay.
export const POST = withApi(
  async ({ request, ctx }) => {
    const { planId, autoRenew } = parse(checkoutSchema, await readJson(request));
    return startCheckout(ctx, planId, request, undefined, { autoRenew });
  },
  { permission: "billing:manage", rateLimit: "checkout" },
);
