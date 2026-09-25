import { withApi } from "@/lib/api";
import { getPurchase } from "@/services/purchases";

export const GET = withApi(async ({ ctx, params }) => getPurchase(ctx, params.id), { permission: "purchases:view" });
