import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { customerSchema } from "@/lib/validators";
import { getCustomer, updateCustomer, deleteCustomer } from "@/services/customers";

export const GET = withApi(async ({ ctx, params }) => getCustomer(ctx, params.id), { permission: "customers:view" });

export const PATCH = withApi(
  async ({ request, ctx, params }) => ({ customer: await updateCustomer(ctx, params.id, parse(customerSchema.partial(), await readJson(request)), request) }),
  { permission: "customers:update", write: true },
);

export const DELETE = withApi(async ({ request, ctx, params }) => deleteCustomer(ctx, params.id, request), { permission: "customers:delete", write: true });
