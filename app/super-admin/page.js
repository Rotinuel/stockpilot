import Link from "next/link";
import { Building2, Activity, Clock, TimerOff, Repeat, Banknote, Wallet, CircleX, UserPlus, TrendingDown } from "lucide-react";
import { requireSuperAdminSession } from "@/lib/session";
import { platformStats, listTenants } from "@/services/admin";
import { toPlain } from "@/lib/serialize";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/utils/format";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/constants";
import { PageHeader, StatCard } from "@/components/ui/Misc";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Badge, { STATUS_TONES } from "@/components/ui/Badge";
import ColumnChart from "@/components/charts/ColumnChart";
import DonutChart from "@/components/charts/DonutChart";
import AnnouncementForm from "@/components/admin/AnnouncementForm";

export const metadata = { title: "Overview" };

export default async function SuperAdminHome() {
  await requireSuperAdminSession();
  const [s, recent] = await Promise.all([platformStats(), listTenants({ limit: 8 })]);
  return (
    <>
      <PageHeader title="Platform overview" description="Businesses, subscriptions and revenue across StockPilot." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total businesses" value={s.totalBusinesses} hint={`${s.suspended} suspended`} icon={Building2} href="/super-admin/tenants" />
        <StatCard label="Active businesses" value={s.activeBusinesses} icon={Activity} tone="green" />
        <StatCard label="On trial" value={s.trialBusinesses} icon={Clock} tone="blue" href="/super-admin/tenants?subscription=trialing" />
        <StatCard label="Expired trials" value={s.expiredTrials} icon={TimerOff} tone="yellow" href="/super-admin/tenants?subscription=expired" />
        <StatCard label="Active subscriptions" value={s.activeSubscriptions} hint={`${s.pastDue} past due · ${s.cancelled} cancelled`} icon={Repeat} tone="purple" href="/super-admin/subscriptions" />
        <StatCard label="MRR" value={formatMoney(s.mrr, "NGN")} hint={`ARR ${formatMoney(s.arr, "NGN")}${s.mrrUsd ? ` · + ${formatMoney(s.mrrUsd, "USD")}/mo in USD` : ""}`} icon={Banknote} tone="green" />
        <StatCard
          label="Total revenue"
          value={formatMoney(s.totalRevenue, "NGN")}
          hint={`${formatMoney(s.revenue30, "NGN")} last 30 days${s.revenueUsd ? ` · USD ${formatMoney(s.revenueUsd, "USD")} (${formatMoney(s.revenue30Usd, "USD")} last 30 days)` : ""}`}
          icon={Wallet}
          tone="blue"
          href="/super-admin/payments"
        />
        <StatCard label="Failed payments (30d)" value={s.failedPayments30} icon={CircleX} tone="red" href="/super-admin/payments?status=failed" />
        <StatCard label="New registrations (30d)" value={s.newRegistrations30} hint={`${s.newToday} today`} icon={UserPlus} tone="brand" />
        <StatCard label="Cancellations (30d)" value={s.cancellations30} hint={`Churn ${s.churnRate}%`} icon={TrendingDown} tone="gray" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Subscription revenue" description="Successful payments, last 6 months (NGN)" />
          <CardBody>
            <ColumnChart data={s.revenueByMonth.map((m) => ({ label: m.label, value: m.total }))} money currency="NGN" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Paying businesses by plan" />
          <CardBody>
            <DonutChart items={s.planDistribution.map((p) => ({ label: p.plan, value: p.count }))} money={false} centerLabel="Businesses" />
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="New registrations" description="Last 30 days" />
          <CardBody>
            <ColumnChart data={s.registrations.map((r) => ({ label: r.date.slice(5), value: r.count }))} />
          </CardBody>
        </Card>
        <AnnouncementForm />
      </div>
      <Card className="mt-6">
        <CardHeader title="Latest businesses" action={<Link href="/super-admin/tenants" className="text-sm font-medium text-brand-600">View all</Link>} />
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Business</th>
                <th className="hidden md:table-cell">Owner</th>
                <th>Subscription</th>
                <th className="hidden sm:table-cell">Joined</th>
              </tr>
            </thead>
            <tbody>
              {toPlain(recent.items).map((t) => (
                <tr key={t._id}>
                  <td>
                    <Link href={`/super-admin/tenants/${t._id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {t.businessName}
                    </Link>
                    <p className="text-xs text-slate-500">{t.businessType}</p>
                  </td>
                  <td className="hidden text-slate-600 md:table-cell">{t.owner?.email}</td>
                  <td>
                    <Badge tone={STATUS_TONES[t.subscriptionStatus]}>{SUBSCRIPTION_STATUS_LABELS[t.subscriptionStatus]}</Badge>
                    {t.status === "suspended" ? <Badge tone="red" className="ml-1">Suspended</Badge> : null}
                  </td>
                  <td className="hidden text-slate-500 sm:table-cell">{formatDate(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
