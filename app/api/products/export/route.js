import { withApi } from "@/lib/api";
import { exportProductsCSV } from "@/services/products";
import { str } from "@/lib/query";
import { logAudit } from "@/services/audit";

// Product export is available on every plan (your data is always yours).
export const GET = withApi(
  async ({ request, ctx, searchParams }) => {
    const csv = await exportProductsCSV(ctx, { search: str(searchParams, "q"), categoryId: str(searchParams, "category"), status: str(searchParams, "status"), stock: str(searchParams, "stock") });
    await logAudit(ctx, "product.export", { entity: "Product", request });
    return new Response(`﻿${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  },
  { permission: "products:export" },
);
