import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { customerSchema } from "@/lib/validators";
import { listCustomers, createCustomer } from "@/services/customers";
import { pageParams, str } from "@/lib/query";

export const GET = withApi(
  async ({ ctx, searchParams }) =>
    listCustomers(ctx, { ...pageParams(searchParams), search: str(searchParams, "q"), type: str(searchParams, "type"), owing: str(searchParams, "owing"), sort: str(searchParams, "sort") }),
  { permission: "customers:view" },
);

export const POST = withApi(
  async ({ request, ctx }) => ({ customer: await createCustomer(ctx, parse(customerSchema, await readJson(request)), request) }),
  { permission: "customers:create", write: true },
);
