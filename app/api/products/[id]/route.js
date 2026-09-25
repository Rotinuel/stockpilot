import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { productUpdateSchema } from "@/lib/validators";
import { getProduct, updateProduct, deleteProduct } from "@/services/products";

export const GET = withApi(async ({ ctx, params }) => getProduct(ctx, params.id), { permission: "products:view" });

export const PATCH = withApi(
  async ({ request, ctx, params }) => {
    const data = parse(productUpdateSchema, await readJson(request));
    return { product: await updateProduct(ctx, params.id, data, request) };
  },
  { permission: "products:update", write: true },
);

export const DELETE = withApi(async ({ request, ctx, params }) => deleteProduct(ctx, params.id, request), {
  permission: "products:delete",
  write: true,
});
