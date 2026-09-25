import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { cancelSaleSchema } from "@/lib/validators";
import { cancelSale } from "@/services/sales";

export const POST = withApi(
  async ({ request, ctx, params }) => cancelSale(ctx, params.id, parse(cancelSaleSchema, await readJson(request)), request),
  { permission: "sales:cancel", write: true },
);
