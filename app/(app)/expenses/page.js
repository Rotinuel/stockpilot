import { Wallet } from "lucide-react";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { listExpenses } from "@/services/expenses";
import { hasFeature } from "@/lib/plans";
import { pageParams, str, rangeFromSearch } from "@/lib/query";
import { toPlain } from "@/lib/serialize";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/utils/format";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { RANGE_PRESETS } from "@/utils/dates";
import { PageHeader, EmptyState, TableCard, StatCard } from "@/components/ui/Misc";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";
import { SearchInput, FilterSelect, RangeFilter } from "@/components/ui/UrlFilters";
import DonutChart from "@/components/charts/DonutChart";
import { AddExpenseButton, ExpenseRowActions } from "@/components/expenses/ExpenseForms";
import { UpgradeCard } from "@/components/layout/Banners";
import AccessDenied from "@/components/layout/AccessDenied";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }) {
  const session = await requireTenantSession();
  if (!sessionCan(session, "expenses:view")) return <AccessDenied />;
  const { ctx } = session;
  if (!hasFeature(session.plan, "expenses")) {
    return (
      <>
        <PageHeader title="Expenses" />
        <UpgradeCard title="Track your expenses" message="Record rent, electricity, fuel, salaries and more to see your true net profit. Expense tracking is included from the Starter plan." />
      </>
    );
  }
  const sp = await searchParams;
  const range = rangeFromSearch(sp, ctx.timezone, "this_month");
  const category = str(sp, "category");
  const data = await listExpenses(ctx, {
    ...pageParams(sp),
    from: range.from,
    to: range.to,
    search: str(sp, "q"),
    category: EXPENSE_CATEGORIES.includes(category) ? category : undefined,
  });
  const canWrite = session.access.canWrite && sessionCan(session, "expenses:manage");

  return (
    <>
      <PageHeader title="Expenses" description="Money spent running the business." actions={sessionCan(session, "expenses:manage") ? <AddExpenseButton currency={ctx.currency} disabled={!session.access.canWrite} /> : null} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <RangeFilter presets={RANGE_PRESETS} />
        <FilterSelect param="category" placeholder="All categories" options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABELS[c] }))} />
        <SearchInput placeholder="Search description…" />
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <StatCard label={`Expenses · ${range.label}`} value={formatMoney(data.summary.total, ctx.currency)} hint={`${data.summary.count} entries`} icon={Wallet} tone="red" />
        </div>
        <Card className="lg:col-span-2">
          <CardHeader title="By category" description={range.label} />
          <CardBody>
            <DonutChart items={toPlain(data.byCategory.map((c) => ({ label: EXPENSE_CATEGORY_LABELS[c._id] || c._id, value: c.total })))} currency={ctx.currency} />
          </CardBody>
        </Card>
      </div>
      {data.items.length ? (
        <TableCard footer={<Pagination page={data.page} pages={data.pages} total={data.total} basePath="/expenses" searchParams={sp} label="expenses" />}>
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th className="hidden sm:table-cell">Description</th>
                <th className="hidden md:table-cell">Method</th>
                <th className="text-right">Amount</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((e) => (
                <tr key={String(e._id)}>
                  <td className="whitespace-nowrap text-slate-600">{formatDate(e.date, { timeZone: ctx.timezone })}</td>
                  <td>
                    <Badge tone="gray">{EXPENSE_CATEGORY_LABELS[e.category]}</Badge>
                  </td>
                  <td className="hidden max-w-72 truncate text-slate-700 sm:table-cell">{e.description || "—"}</td>
                  <td className="hidden text-slate-600 md:table-cell">{PAYMENT_METHOD_LABELS[e.paymentMethod]}</td>
                  <td className="text-right font-medium tabular-nums">{formatMoney(e.amount, ctx.currency)}</td>
                  <td>
                    <ExpenseRowActions expense={toPlain(e)} currency={ctx.currency} canWrite={canWrite} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState icon={Wallet} title="No expenses in this period" description="Record expenses to see your real net profit." />
        </div>
      )}
    </>
  );
}
