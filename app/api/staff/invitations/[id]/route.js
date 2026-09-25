import { withApi } from "@/lib/api";
import { revokeInvitation } from "@/services/staff";

export const DELETE = withApi(async ({ request, ctx, params }) => revokeInvitation(ctx, params.id, request), { permission: "staff:manage" });
