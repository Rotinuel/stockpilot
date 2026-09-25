import Link from "next/link";
import { requireSuperAdminSession } from "@/lib/session";
import { listPayments } from "@/services/admin";
import { pageParams, str } from "@/lib/query";
import { toPlain } from "@/lib/serialize";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/utils/format";
import { PageHeader, TableCard, StatCard } from "@/components/ui/Misc";
import Badge, { STATUS_TONES } from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";
import { SearchInput, FilterSelect } from "@/components/ui/UrlFilters";

export const metadata = { title: "Payments" };
const STATUSES = ["success", "pending", "failed", "abandoned", "reversed"];

export default async function AdminPaymentsPage({ searchParams }) {
  await requireSuperAdminSession();
  const sp = await searchParams;
  const status = str(sp, "status");
  const data = await listPayments({ ...pageParams(sp, 25), status: STATUSES.includes(status) ? status : undefined, search: str(sp, "q") });
  const by = Object.fromEntries(data.byStatus.map((b) => [b._id, b]));
  const items = toPlain(data.items);
  return (
    <>
      <PageHeader title="Payments" description="Subscription payments processed through Paystack." />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Successful" value={formatMoney(by.success?.total || 0, "NGN")} hint={`${by.success?.count || 0} payments`} tone="green" />
        <StatCard label="Failed" value={by.failed?.count || 0} tone="red" href="/super-admin/payments?status=failed" />
        <StatCard label="Pending / abandoned" value={(by.pending?.count || 0) + (by.abandoned?.count || 0)} tone="yellow" />
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput placeholder="Search reference…" />
        <FilterSelect param="status" placeholder="Any status" options={STATUSES.map((s) => ({ value: s, label: s }))} />
      </div>
      <TableCard footer={<Pagination page={data.page} pages={data.pages} total={data.total} basePath="/super-admin/payments" searchParams={sp} label="payments" />}>
        <table className="table-base">
          <thead>
            <tr>
              <th>Date</th>
              <th>Business</th>
              <th className="hidden md:table-cell">Reference</th>
              <th className="hidden sm:table-cell">Plan</th>
              <th className="text-right">Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p._id}>
                <td className="whitespace-nowrap text-slate-600">{formatDateTime(p.paidAt || p.createdAt)}</td>
                <td>
                  <Link href={`/super-admin/tenants/${p.tenantId}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {p.businessName}
                  </Link>
                </td>
                <td className="hidden font-mono text-xs text-slate-500 md:table-cell">{p.reference}</td>
                <td className="hidden capitalize sm:table-cell">
                  {p.planCode} <span className="text-xs text-slate-400">· {p.purpose}</span>
                </td>
                <td className="text-right font-medium tabular-nums">{formatMoney(p.amount, p.currency)}</td>
                <td>
                  <Badge tone={STATUS_TONES[p.status]}>{p.status}</Badge>
                  {p.failureReason && p.status !== "success" ? <p className="max-w-40 truncate text-xs text-slate-500">{p.failureReason}</p> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}
