import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { checkoutSchema } from "@/lib/validators";
import { changePlan } from "@/services/billing";

// Upgrade (immediate checkout) or downgrade (scheduled at period end).
export const POST = withApi(
  async ({ request, ctx }) => {
    const { planId, autoRenew } = parse(checkoutSchema, await readJson(request));
    return changePlan(ctx, planId, request, { autoRenew });
  },
  { permission: "billing:manage", rateLimit: "checkout" },
);
