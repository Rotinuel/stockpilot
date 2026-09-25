import Link from "next/link";
import { requireSuperAdminSession } from "@/lib/session";
import { listSubscriptions } from "@/services/admin";
import { pageParams, str } from "@/lib/query";
import { toPlain } from "@/lib/serialize";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/utils/format";
import { SUBSCRIPTION_STATUSES, SUBSCRIPTION_STATUS_LABELS } from "@/lib/constants";
import { PageHeader, TableCard } from "@/components/ui/Misc";
import Badge, { STATUS_TONES } from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";
import { FilterSelect } from "@/components/ui/UrlFilters";

export const metadata = { title: "Subscriptions" };

export default async function AdminSubscriptionsPage({ searchParams }) {
  await requireSuperAdminSession();
  const sp = await searchParams;
  const status = str(sp, "status");
  const data = await listSubscriptions({ ...pageParams(sp, 25), status: SUBSCRIPTION_STATUSES.includes(status) ? status : undefined });
  const items = toPlain(data.items);
  return (
    <>
      <PageHeader title="Subscriptions" description="Subscription periods across all businesses (history included)." />
      <div className="mb-4">
        <FilterSelect param="status" placeholder="Any status" options={SUBSCRIPTION_STATUSES.map((s) => ({ value: s, label: SUBSCRIPTION_STATUS_LABELS[s] }))} />
      </div>
      <TableCard footer={<Pagination page={data.page} pages={data.pages} total={data.total} basePath="/super-admin/subscriptions" searchParams={sp} label="subscriptions" />}>
        <table className="table-base">
          <thead>
            <tr>
              <th>Business</th>
              <th>Plan</th>
              <th>Status</th>
              <th className="hidden md:table-cell">Period</th>
              <th className="hidden text-right sm:table-cell">Amount</th>
              <th className="hidden lg:table-cell">Type</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s._id}>
                <td>
                  <Link href={`/super-admin/tenants/${s.tenantId}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {s.businessName}
                  </Link>
                </td>
                <td>{s.planName}</td>
                <td>
                  <Badge tone={STATUS_TONES[s.status]}>{SUBSCRIPTION_STATUS_LABELS[s.status]}</Badge>
                </td>
                <td className="hidden text-slate-600 md:table-cell">
                  {formatDate(s.currentPeriodStart)} → {formatDate(s.currentPeriodEnd)}
                </td>
                <td className="hidden text-right tabular-nums sm:table-cell">{formatMoney(s.amount || 0, s.currency)}</td>
                <td className="hidden capitalize text-slate-500 lg:table-cell">{s.changeType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}
