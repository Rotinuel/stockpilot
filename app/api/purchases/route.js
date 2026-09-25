import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { purchaseSchema } from "@/lib/validators";
import { createPurchase, listPurchases } from "@/services/purchases";
import { pageParams, str, optionalDateRange } from "@/lib/query";

export const GET = withApi(
  async ({ ctx, searchParams }) =>
    listPurchases(ctx, {
      ...pageParams(searchParams),
      ...optionalDateRange(searchParams, ctx.timezone),
      search: str(searchParams, "q"),
      supplierId: str(searchParams, "supplier"),
      paymentStatus: str(searchParams, "payment"),
      status: str(searchParams, "status"),
    }),
  { permission: "purchases:view" },
);

export const POST = withApi(
  async ({ request, ctx }) => createPurchase(ctx, parse(purchaseSchema, await readJson(request)), request),
  { permission: "purchases:create", write: true },
);
