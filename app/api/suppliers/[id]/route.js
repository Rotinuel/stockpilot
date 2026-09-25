import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { supplierSchema } from "@/lib/validators";
import { getSupplier, updateSupplier, deleteSupplier } from "@/services/suppliers";

export const GET = withApi(async ({ ctx, params }) => getSupplier(ctx, params.id), { permission: "suppliers:view" });

export const PATCH = withApi(
  async ({ request, ctx, params }) => ({ supplier: await updateSupplier(ctx, params.id, parse(supplierSchema.partial(), await readJson(request)), request) }),
  { permission: "suppliers:manage", write: true },
);

export const DELETE = withApi(async ({ request, ctx, params }) => deleteSupplier(ctx, params.id, request), { permission: "suppliers:delete", write: true });
