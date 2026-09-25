import { withApi } from "@/lib/api";
import { listMovements } from "@/services/stock";
import { pageParams, str, optionalDateRange } from "@/lib/query";
import { MOVEMENT_TYPES } from "@/lib/constants";

export const GET = withApi(
  async ({ ctx, searchParams }) => {
    const type = str(searchParams, "type");
    const productId = str(searchParams, "product");
    return listMovements(ctx, {
      ...pageParams(searchParams),
      ...optionalDateRange(searchParams, ctx.timezone),
      type: MOVEMENT_TYPES.includes(type) ? type : undefined,
      productId: productId && /^[a-f0-9]{24}$/i.test(productId) ? productId : undefined,
      search: str(searchParams, "q"),
    });
  },
  { permission: "inventory:view" },
);
