import { withApi } from "@/lib/api";
import { getSale } from "@/services/sales";

export const GET = withApi(async ({ ctx, params }) => getSale(ctx, params.id), { permission: "sales:view" });
