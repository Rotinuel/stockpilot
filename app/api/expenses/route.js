import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { expenseSchema } from "@/lib/validators";
import { listExpenses, createExpense } from "@/services/expenses";
import { pageParams, str, optionalDateRange } from "@/lib/query";
import { EXPENSE_CATEGORIES } from "@/lib/constants";

export const GET = withApi(
  async ({ ctx, searchParams }) => {
    const category = str(searchParams, "category");
    return listExpenses(ctx, {
      ...pageParams(searchParams),
      ...optionalDateRange(searchParams, ctx.timezone),
      search: str(searchParams, "q"),
      category: EXPENSE_CATEGORIES.includes(category) ? category : undefined,
    });
  },
  { permission: "expenses:view", feature: "expenses" },
);

export const POST = withApi(
  async ({ request, ctx }) => ({ expense: await createExpense(ctx, parse(expenseSchema, await readJson(request)), request) }),
  { permission: "expenses:manage", write: true, feature: "expenses" },
);
