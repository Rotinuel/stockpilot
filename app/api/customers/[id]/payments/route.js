import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { balancePaymentSchema } from "@/lib/validators";
import { recordCustomerPayment } from "@/services/customers";

export const POST = withApi(
  async ({ request, ctx, params }) => recordCustomerPayment(ctx, params.id, parse(balancePaymentSchema, await readJson(request)), request),
  { permission: "customers:payments", write: true },
);
