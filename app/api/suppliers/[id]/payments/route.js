import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { balancePaymentSchema } from "@/lib/validators";
import { recordSupplierPayment } from "@/services/suppliers";

export const POST = withApi(
  async ({ request, ctx, params }) => recordSupplierPayment(ctx, params.id, parse(balancePaymentSchema, await readJson(request)), request),
  { permission: "suppliers:payments", write: true },
);
