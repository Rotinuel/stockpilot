import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { stockAdjustSchema } from "@/lib/validators";
import { adjustStock } from "@/services/stock";

export const POST = withApi(
  async ({ request, ctx }) => adjustStock(ctx, parse(stockAdjustSchema, await readJson(request)), request),
  { permission: "inventory:adjust", write: true },
);
