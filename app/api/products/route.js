import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { productSchema } from "@/lib/validators";
import { listProducts, createProduct } from "@/services/products";
import { pageParams, str } from "@/lib/query";

export const GET = withApi(
  async ({ ctx, searchParams }) =>
    listProducts(ctx, {
      ...pageParams(searchParams),
      search: str(searchParams, "q"),
      categoryId: str(searchParams, "category"),
      status: str(searchParams, "status"),
      stock: str(searchParams, "stock"),
      supplierId: str(searchParams, "supplier"),
      sort: str(searchParams, "sort"),
    }),
  { permission: "products:view" },
);

export const POST = withApi(
  async ({ request, ctx }) => {
    const data = parse(productSchema, await readJson(request));
    return { product: await createProduct(ctx, data, request) };
  },
  { permission: "products:create", write: true },
);
