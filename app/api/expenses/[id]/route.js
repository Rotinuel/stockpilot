import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { expenseSchema } from "@/lib/validators";
import { updateExpense, deleteExpense } from "@/services/expenses";

export const PATCH = withApi(
  async ({ request, ctx, params }) => ({ expense: await updateExpense(ctx, params.id, parse(expenseSchema.partial(), await readJson(request)), request) }),
  { permission: "expenses:manage", write: true, feature: "expenses" },
);

export const DELETE = withApi(async ({ request, ctx, params }) => deleteExpense(ctx, params.id, request), {
  permission: "expenses:manage",
  write: true,
  feature: "expenses",
});
