import { withApi } from "@/lib/api";
import { syncPlanToPaystack } from "@/services/billing";
import { invalidatePlanCache } from "@/services/plans";
import { logAudit } from "@/services/audit";

export const POST = withApi(
  async ({ request, params, session }) => {
    const result = await syncPlanToPaystack(params.id);
    invalidatePlanCache();
    await logAudit({ userId: session.user._id, userName: session.user.name, role: "super_admin" }, "plan.paystack_sync", { tenantId: null, entity: "SubscriptionPlan", entityId: params.id, metadata: result, request });
    return result;
  },
  { superAdmin: true },
);
