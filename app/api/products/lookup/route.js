import { withApi } from "@/lib/api";
import { lookupProducts } from "@/services/products";
import { str } from "@/lib/query";

export const GET = withApi(
  async ({ ctx, searchParams }) => ({ items: await lookupProducts(ctx, str(searchParams, "q", 80), { locationId: str(searchParams, "location") }) }),
  { permission: "products:view" },
);
