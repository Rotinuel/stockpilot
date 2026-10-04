import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { referralAdminActionSchema } from "@/lib/validators";
import { adminReferralAction } from "@/services/referrals";

// Super admin: mark a referral commission as paid / owed again, or void a referral.
export const PATCH = withApi(
  async ({ request, params, session }) => adminReferralAction(params.id, parse(referralAdminActionSchema, await readJson(request)), session.user, request),
  { superAdmin: true },
);
