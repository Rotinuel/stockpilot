import { notFound } from "next/navigation";
import { requireSuperAdminSession } from "@/lib/session";
import { getTenantDetail } from "@/services/admin";
import { getAllPlans } from "@/services/plans";
import { computeAccess } from "@/lib/access";
import { toPlain } from "@/lib/serialize";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime, timeAgo } from "@/utils/format";
import { SUBSCRIPTION_STATUS_LABELS, ROLE_LABELS } from "@/lib/constants";
import { limitLabel } from "@/lib/plans";
import { PageHeader, KeyValue, Alert } from "@/components/ui/Misc";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Badge, { STATUS_TONES } from "@/components/ui/Badge";
import TenantActions from "@/components/admin/TenantActions";

export const metadata = { title: "Business" };

export default async function TenantDetailPage({ params }) {
  await requireSuperAdminSession();
  const { id } = await params;
  let d;
  try {
    d = await getTenantDetail(id);
  } catch {
    notFound();
  }
  const plans = toPlain(await getAllPlans({ includeInactive: true }));
  const access = computeAccess(d.tenant);
  const t = toPlain(d.tenant);
  const data = toPlain(d);
  return (
    <>
      <PageHeader back={{ href: "/super-admin/tenants", label: "Businesses" }} title={t.businessName} description={`${t.slug} · ${t.businessType || "—"} · joined ${formatDate(t.createdAt)}`} actions={<TenantActions tenant={{ _id: t._id, businessName: t.businessName, status: t.status }} plans={plans.map((p) => ({ _id: p._id, name: p.name, isTrial: p.isTrial }))} />} />
      {t.status === "suspended" ? (
        <Alert tone="danger" className="mb-6" title="Suspended">
          {t.suspendedReason || "No reason recorded"} · since {formatDateTime(t.suspendedAt)}
        </Alert>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Subscription" />
          <CardBody className="divide-y divide-slate-100 py-2">
            <KeyValue label="Plan" value={data.plan?.name || t.subscriptionPlanCode} />
            <KeyValue label="Status" value={<Badge tone={STATUS_TONES[t.subscriptionStatus]}>{SUBSCRIPTION_STATUS_LABELS[t.subscriptionStatus]}</Badge>} />
            <KeyValue label="Access" value={access.canWrite ? <Badge tone="green">Full</Badge> : <Badge tone="red">Read-only</Badge>} />
            <KeyValue label="Trial" value={`${formatDate(t.trialStartedAt)} → ${formatDate(t.trialEndsAt)}`} />
            <KeyValue label="Period" value={t.subscriptionStartDate ? `${formatDate(t.subscriptionStartDate)} → ${formatDate(t.subscriptionEndDate)}` : "—"} />
            <KeyValue label="Paystack customer" value={<span className="font-mono text-xs">{t.paystackCustomerCode || "—"}</span>} />
            <KeyValue label="Paystack subscription" value={<span className="font-mono text-xs">{t.paystackSubscriptionCode || "—"}</span>} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Usage" />
          <CardBody className="divide-y divide-slate-100 py-2">
            <KeyValue label="Products" value={`${data.usage.products} / ${limitLabel(data.plan?.limits?.products)}`} />
            <KeyValue label="Staff" value={`${data.usage.staffUsers} / ${limitLabel(data.plan?.limits?.staffUsers)}`} />
            <KeyValue label="Locations" value={`${data.usage.locations} / ${limitLabel(data.plan?.limits?.locations)}`} />
            <KeyValue label="Sales this month" value={data.usage.monthlyTransactions} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Contact" />
          <CardBody className="divide-y divide-slate-100 py-2">
            <KeyValue label="Email" value={t.email || "—"} />
            <KeyValue label="Phone" value={t.phone || "—"} />
            <KeyValue label="Country" value={t.country} />
            <KeyValue label="Currency" value={t.currency} />
            <KeyValue label="Onboarding" value={t.onboarding?.completed ? "Completed" : `Step ${t.onboarding?.step || 1}`} />
          </CardBody>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Users (${data.users.length})`} />
          <ul className="divide-y divide-slate-100">
            {data.users.map((u) => (
              <li key={u._id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span>
                  <span className="font-medium text-slate-900">{u.name}</span> <span className="text-slate-500">· {u.email}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone="brand">{ROLE_LABELS[u.role]}</Badge>
                  {!u.isActive ? <Badge tone="gray">Inactive</Badge> : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Payments" />
          <ul className="divide-y divide-slate-100">
            {data.payments.length ? (
              data.payments.map((p) => (
                <li key={p._id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span>
                    {formatMoney(p.amount, p.currency)} · <span className="capitalize">{p.planCode}</span> <span className="text-xs text-slate-500">{formatDateTime(p.createdAt)}</span>
                  </span>
                  <Badge tone={STATUS_TONES[p.status]}>{p.status}</Badge>
                </li>
              ))
            ) : (
              <li className="px-5 py-6 text-center text-sm text-slate-500">No payments.</li>
            )}
          </ul>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Recent activity" />
          <ul className="divide-y divide-slate-100">
            {data.audit.map((a) => (
              <li key={a._id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  <Badge tone="gray">{a.action}</Badge> <span className="text-slate-600">{a.userName}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-400">{timeAgo(a.timestamp)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
