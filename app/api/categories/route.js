import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { categorySchema } from "@/lib/validators";
import { listCategories, createCategory } from "@/services/products";

export const GET = withApi(async ({ ctx }) => ({ items: await listCategories(ctx) }), { permission: "products:view" });

export const POST = withApi(
  async ({ request, ctx }) => ({ category: await createCategory(ctx, parse(categorySchema, await readJson(request)), request) }),
  { permission: "categories:manage", write: true },
);
