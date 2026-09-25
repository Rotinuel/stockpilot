import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { categorySchema } from "@/lib/validators";
import { updateCategory, deleteCategory } from "@/services/products";

export const PATCH = withApi(
  async ({ request, ctx, params }) => ({ category: await updateCategory(ctx, params.id, parse(categorySchema, await readJson(request))) }),
  { permission: "categories:manage", write: true },
);

export const DELETE = withApi(async ({ request, ctx, params }) => deleteCategory(ctx, params.id, request), {
  permission: "categories:manage",
  write: true,
});
