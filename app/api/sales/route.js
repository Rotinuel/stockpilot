import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { saleSchema } from "@/lib/validators";
import { createSale, listSales } from "@/services/sales";
import { pageParams, str, optionalDateRange } from "@/lib/query";

export const GET = withApi(
  async ({ ctx, searchParams }) =>
    listSales(ctx, {
      ...pageParams(searchParams),
      ...optionalDateRange(searchParams, ctx.timezone),
      search: str(searchParams, "q"),
      status: str(searchParams, "status"),
      paymentMethod: str(searchParams, "method"),
      paymentStatus: str(searchParams, "payment"),
      customerId: str(searchParams, "customer"),
    }),
  { permission: "sales:view" },
);

export const POST = withApi(
  async ({ request, ctx }) => {
    const data = parse(saleSchema, await readJson(request));
    return createSale(ctx, data, request);
  },
  { permission: ["pos:use", "sales:create"], write: true },
);
