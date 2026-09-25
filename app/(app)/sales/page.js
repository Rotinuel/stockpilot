import Link from "next/link";
import { Receipt, ShoppingCart } from "lucide-react";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { listSales } from "@/services/sales";
import { pageParams, str, optionalDateRange } from "@/lib/query";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/utils/format";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { RANGE_PRESETS } from "@/utils/dates";
import { PageHeader, EmptyState, TableCard, StatCard } from "@/components/ui/Misc";
import Badge, { STATUS_TONES } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import { SearchInput, FilterSelect } from "@/components/ui/UrlFilters";
import AccessDenied from "@/components/layout/AccessDenied";

export const metadata = { title: "Sales" };

export default async function SalesPage({ searchParams }) {
  const session = await requireTenantSession();
  if (!sessionCan(session, "sales:view")) return <AccessDenied />;
  const sp = await searchParams;
  const { ctx } = session;
  const data = await listSales(ctx, {
    ...pageParams(sp),
    ...optionalDateRange(sp, ctx.timezone),
    search: str(sp, "q"),
    status: str(sp, "status"),
    paymentMethod: PAYMENT_METHODS.includes(str(sp, "method")) ? str(sp, "method") : undefined,
    paymentStatus: str(sp, "payment"),
    customerId: str(sp, "customer"),
  });
  const own = !sessionCan(session, "sales:view_all");

  return (
    <>
      <PageHeader
        title="Sales"
        description={own ? "Sales you have recorded." : "Every sale recorded at your business."}
        actions={sessionCan(session, "pos:use") ? <Button href="/pos" icon={ShoppingCart}>New sale</Button> : null}
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Sales in view" value={formatMoney(data.summary.total, ctx.currency)} hint={`${data.summary.count} completed`} />
        <StatCard label="Unpaid balances" value={formatMoney(data.summary.balance, ctx.currency)} tone="yellow" />
        <StatCard label="Transactions" value={data.total} hint="Including cancelled" tone="gray" />
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput placeholder="Invoice # or customer…" />
        <FilterSelect param="range" placeholder="All time" options={RANGE_PRESETS.filter((r) => r.value !== "custom")} />
        <FilterSelect param="method" placeholder="All payment methods" options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} />
        <FilterSelect param="payment" placeholder="Any payment status" options={[{ value: "paid", label: "Paid" }, { value: "partial", label: "Part-paid" }, { value: "unpaid", label: "Unpaid" }]} />
        <FilterSelect param="status" placeholder="Any status" options={[{ value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }]} />
      </div>
      {data.items.length ? (
        <TableCard footer={<Pagination page={data.page} pages={data.pages} total={data.total} basePath="/sales" searchParams={sp} label="sales" />}>
          <table className="table-base">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th className="hidden md:table-cell">Cashier</th>
                <th className="hidden sm:table-cell">Method</th>
                <th className="text-right">Total</th>
                <th className="hidden lg:table-cell">Payment</th>
                <th className="hidden md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={String(s._id)} className={s.status === "cancelled" ? "opacity-60" : ""}>
                  <td>
                    <Link href={`/sales/${s._id}`} className="font-medium text-brand-700 hover:underline">
                      {s.invoiceNumber}
                    </Link>
                    {s.status === "cancelled" ? <Badge tone="red" className="ml-2">Cancelled</Badge> : null}
                  </td>
                  <td className="max-w-44 truncate text-slate-700">{s.customerName}</td>
                  <td className="hidden text-slate-600 md:table-cell">{s.cashierName}</td>
                  <td className="hidden text-slate-600 sm:table-cell">{PAYMENT_METHOD_LABELS[s.paymentMethod]}</td>
                  <td className="text-right font-medium tabular-nums">{formatMoney(s.total, ctx.currency)}</td>
                  <td className="hidden lg:table-cell">
                    <Badge tone={STATUS_TONES[s.paymentStatus]}>{s.paymentStatus === "partial" ? `Owes ${formatMoney(s.balance, ctx.currency)}` : s.paymentStatus}</Badge>
                  </td>
                  <td className="hidden whitespace-nowrap text-slate-500 md:table-cell">{formatDateTime(s.createdAt, { timeZone: ctx.timezone })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState icon={Receipt} title="No sales found" description="Completed sales from the POS appear here." action={sessionCan(session, "pos:use") ? <Button href="/pos">Open POS</Button> : null} />
        </div>
      )}
    </>
  );
}
