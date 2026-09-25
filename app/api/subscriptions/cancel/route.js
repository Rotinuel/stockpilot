import { withApi } from "@/lib/api";
import { cancelSubscription } from "@/services/billing";

export const POST = withApi(async ({ request, ctx }) => cancelSubscription(ctx, request), { permission: "billing:manage" });
