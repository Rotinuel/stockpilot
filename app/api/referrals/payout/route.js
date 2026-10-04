import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { referralPayoutSchema } from "@/lib/validators";
import { updatePayoutDetails } from "@/services/referrals";

// Bank details for referral commission payouts (business owner only).
export const PATCH = withApi(
  async ({ request, ctx }) => updatePayoutDetails(ctx, parse(referralPayoutSchema, await readJson(request)), request),
  { permission: "referrals:manage", rateLimit: { limit: 10, windowMs: 10 * 60 * 1000 } },
);
