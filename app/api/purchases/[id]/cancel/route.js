import { withApi } from "@/lib/api";
import { cancelPurchase } from "@/services/purchases";

export const POST = withApi(async ({ request, ctx, params }) => cancelPurchase(ctx, params.id, request), { permission: "purchases:cancel", write: true });
