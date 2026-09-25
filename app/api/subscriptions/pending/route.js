import { withApi } from "@/lib/api";
import { cancelPendingChange } from "@/services/billing";

export const DELETE = withApi(async ({ request, ctx }) => cancelPendingChange(ctx, request), { permission: "billing:manage" });
