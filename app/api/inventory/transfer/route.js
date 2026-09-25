import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { stockTransferSchema } from "@/lib/validators";
import { transferStock } from "@/services/stock";

export const POST = withApi(
  async ({ request, ctx }) => transferStock(ctx, parse(stockTransferSchema, await readJson(request)), request),
  { permission: "inventory:transfer", write: true, feature: "multiLocation" },
);
