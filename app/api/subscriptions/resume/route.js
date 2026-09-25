import { withApi } from "@/lib/api";
import { resumeSubscription } from "@/services/billing";

export const POST = withApi(async ({ request, ctx }) => resumeSubscription(ctx, request), { permission: "billing:manage" });
