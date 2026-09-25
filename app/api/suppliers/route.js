import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { supplierSchema } from "@/lib/validators";
import { listSuppliers, createSupplier } from "@/services/suppliers";
import { pageParams, str } from "@/lib/query";

export const GET = withApi(
  async ({ ctx, searchParams }) => listSuppliers(ctx, { ...pageParams(searchParams), search: str(searchParams, "q"), owing: str(searchParams, "owing") }),
  { permission: "suppliers:view" },
);

export const POST = withApi(
  async ({ request, ctx }) => ({ supplier: await createSupplier(ctx, parse(supplierSchema, await readJson(request)), request) }),
  { permission: "suppliers:manage", write: true },
);
