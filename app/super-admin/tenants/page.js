import Link from "next/link";
import { Building2 } from "lucide-react";
import { requireSuperAdminSession } from "@/lib/session";
import { listTenants } from "@/services/admin";
import { getAllPlans } from "@/services/plans";
import { pageParams, str } from "@/lib/query";
import { toPlain } from "@/lib/serialize";
import { formatDate } from "@/utils/format";
import { SUBSCRIPTION_STATUSES, SUBSCRIPTION_STATUS_LABELS } from "@/lib/constants";
import { PageHeader, TableCard, EmptyState } from "@/components/ui/Misc";
import Badge, { STATUS_TONES } from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";
import { SearchInput, FilterSelect } from "@/components/ui/UrlFilters";

export const metadata = { title: "Businesses" };

export default async function TenantsPage({ searchParams }) {
  await requireSuperAdminSession();
  const sp = await searchParams;
  const [data, plans] = await Promise.all([
    listTenants({ ...pageParams(sp), search: str(sp, "q"), subscriptionStatus: SUBSCRIPTION_STATUSES.includes(str(sp, "subscription")) ? str(sp, "subscription") : undefined, status: ["active", "suspended"].includes(str(sp, "status")) ? str(sp, "status") : undefined, planId: str(sp, "plan") }),
    getAllPlans({ includeInactive: true }),
  ]);
  const items = toPlain(data.items);
  const planMap = new Map(plans.map((p) => [String(p._id), p.name]));
  return (
    <>
      <PageHeader title="Businesses" description={`${data.total} registered businesses`} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <SearchInput placeholder="Business, email, phone…" />
        <FilterSelect param="subscription" placeholder="Any subscription" options={SUBSCRIPTION_STATUSES.map((s) => ({ value: s, label: SUBSCRIPTION_STATUS_LABELS[s] }))} />
        <FilterSelect param="status" placeholder="Any status" options={[{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }]} />
        <FilterSelect param="plan" placeholder="Any plan" options={plans.map((p) => ({ value: String(p._id), label: p.name }))} />
      </div>
      {items.length ? (
        <TableCard footer={<Pagination page={data.page} pages={data.pages} total={data.total} basePath="/super-admin/tenants" searchParams={sp} label="businesses" />}>
          <table className="table-base">
            <thead>
              <tr>
                <th>Business</th>
                <th className="hidden md:table-cell">Owner</th>
                <th>Plan</th>
                <th>Subscription</th>
                <th className="hidden lg:table-cell">Trial / period ends</th>
                <th className="hidden sm:table-cell">Joined</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t._id}>
                  <td>
                    <Link href={`/super-admin/tenants/${t._id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {t.businessName}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {t.businessType} · {t.country}
                    </p>
                  </td>
                  <td className="hidden md:table-cell">
                    <p className="text-slate-700">{t.owner?.name}</p>
                    <p className="text-xs text-slate-500">{t.owner?.email}</p>
                  </td>
                  <td className="text-slate-700">{planMap.get(String(t.subscriptionPlan)) || t.subscriptionPlanCode}</td>
                  <td>
                    <Badge tone={STATUS_TONES[t.subscriptionStatus]}>{SUBSCRIPTION_STATUS_LABELS[t.subscriptionStatus]}</Badge>
                    {t.status === "suspended" ? <Badge tone="red" className="ml-1">Suspended</Badge> : null}
                  </td>
                  <td className="hidden text-slate-600 lg:table-cell">{formatDate(t.subscriptionStatus === "trialing" ? t.trialEndsAt : t.subscriptionEndDate)}</td>
                  <td className="hidden text-slate-500 sm:table-cell">{formatDate(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState icon={Building2} title="No businesses found" />
        </div>
      )}
    </>
  );
}
