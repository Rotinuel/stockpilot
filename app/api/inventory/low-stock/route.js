import { withApi } from "@/lib/api";
import { listLowStock } from "@/services/stock";
import { pageParams, str } from "@/lib/query";

export const GET = withApi(async ({ ctx, searchParams }) => listLowStock(ctx, { ...pageParams(searchParams), search: str(searchParams, "q") }), {
  permission: "products:view",
});
