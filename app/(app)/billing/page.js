import { CreditCard, CalendarClock, Info, Receipt } from "lucide-react";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { getBillingOverview } from "@/services/billing";
import { toPlain } from "@/lib/serialize";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/utils/format";
import { limitLabel } from "@/lib/plans";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/constants";
import { PageHeader, Alert, ProgressBar, KeyValue, TableCard, EmptyState } from "@/components/ui/Misc";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Badge, { STATUS_TONES } from "@/components/ui/Badge";
import { PlanCards, SubscriptionControls } from "@/components/billing/BillingClient";
import AccessDenied from "@/components/layout/AccessDenied";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const session = await requireTenantSession();
  if (!sessionCan(session, "billing:view")) return <AccessDenied />;
  const { ctx, access } = session;
  const data = toPlain(await getBillingOverview(ctx));
  const { tenant, currentPlan, plans, payments, usage, pendingPlan } = data;
  const canManage = sessionCan(session, "billing:manage");
  const isTrial = tenant.subscriptionStatus === "trialing";
  const isPaidActive = ["active", "past_due", "cancelled"].includes(access.state);
  const statusLabel = access.state === "trial_expired" ? "Trial expired" : SUBSCRIPTION_STATUS_LABELS[access.effectiveStatus] || access.effectiveStatus;
  const usageRows = [
    { key: "products", label: "Products", value: usage.products },
    { key: "staffUsers", label: "Staff users", value: usage.staffUsers },
    { key: "locations", label: "Locations", value: usage.locations },
    { key: "monthlyTransactions", label: "Sales this month", value: usage.monthlyTransactions },
  ];

  return (
    <>
      <PageHeader title="Billing" description="Your plan, subscription and payment history." />
      {!data.paystackConfigured ? (
        <Alert tone="warning" icon={Info} className="mb-6" title="Online payments are not configured">
          The platform administrator needs to add Paystack API keys before subscriptions can be purchased.
        </Alert>
      ) : null}
      {!canManage ? (
        <Alert tone="info" icon={Info} className="mb-6">
          Only the business owner can change or cancel the subscription.
        </Alert>
      ) : null}
      {pendingPlan ? (
        <Alert tone="info" icon={CalendarClock} className="mb-6" title={`Scheduled change to ${pendingPlan.name}`}>
          Takes effect on {formatDate(tenant.pendingPlanChange?.effectiveAt)}.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Current plan"
            icon={CreditCard}
            action={<SubscriptionControls status={tenant.subscriptionStatus} canManage={canManage} hasCard={Boolean(tenant.paystackSubscriptionCode)} hasPending={Boolean(pendingPlan)} accessUntil={tenant.subscriptionEndDate ? formatDate(tenant.subscriptionEndDate) : null} />}
          />
          <CardBody>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-2xl font-bold text-slate-900">{currentPlan?.name}</p>
                <p className="text-sm text-slate-500">{isTrial ? "7-day free trial — all your data is kept when you subscribe" : currentPlan?.price ? `${formatMoney(currentPlan.price, currentPlan.currency)} per ${currentPlan.interval}` : ""}</p>
              </div>
              <Badge tone={STATUS_TONES[access.effectiveStatus] || "gray"} dot>
                {statusLabel}
              </Badge>
            </div>
            {access.message ? <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${access.canWrite ? "bg-slate-50 text-slate-700" : "bg-rose-50 text-rose-700"}`}>{access.message}</p> : null}
            <div className="mt-5 grid gap-x-8 sm:grid-cols-2">
              <div className="divide-y divide-slate-100">
                {isTrial ? (
                  <>
                    <KeyValue label="Trial started" value={formatDateTime(tenant.trialStartedAt)} />
                    <KeyValue label="Trial ends" value={formatDateTime(tenant.trialEndsAt)} />
                    <KeyValue label="Days remaining" value={access.daysLeft} />
                  </>
                ) : (
                  <>
                    <KeyValue label="Current period started" value={formatDate(tenant.subscriptionStartDate)} />
                    <KeyValue label={tenant.subscriptionStatus === "cancelled" ? "Access until" : "Next billing date"} value={formatDate(tenant.nextBillingDate || tenant.subscriptionEndDate)} />
                    {access.inGrace ? <KeyValue label="Grace period ends" value={formatDate(access.graceEndsAt)} /> : null}
                  </>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                <KeyValue label="Payment method" value={tenant.cardLast4 ? `${(tenant.cardBrand || "Card").toUpperCase()} •••• ${tenant.cardLast4}` : "—"} />
                <KeyValue label="Billing email" value={tenant.email || "—"} />
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Usage" description={`Limits on the ${currentPlan?.name} plan`} />
          <CardBody className="space-y-4">
            {usageRows.map((r) => (
              <div key={r.key}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-600">{r.label}</span>
                  <span className="font-medium text-slate-900 tabular-nums">
                    {r.value.toLocaleString("en-NG")} / {limitLabel(currentPlan?.limits?.[r.key])}
                  </span>
                </div>
                <ProgressBar value={r.value} max={currentPlan?.limits?.[r.key]} />
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <h2 className="mt-10 mb-4 text-lg font-semibold text-slate-900">{isPaidActive ? "Change plan" : "Choose a plan"}</h2>
      <PlanCards
        plans={plans}
        currentPlanId={tenant.subscriptionPlan}
        currentPrice={currentPlan?.price || 0}
        isPaidActive={isPaidActive}
        canManage={canManage}
        paystackConfigured={data.paystackConfigured}
        periodEnd={tenant.subscriptionEndDate ? formatDate(tenant.subscriptionEndDate) : null}
      />
      <p className="mt-3 text-xs text-slate-500">Payments are processed securely by Paystack. Upgrades start immediately; downgrades apply at the end of your current billing period.</p>

      <h2 className="mt-10 mb-4 text-lg font-semibold text-slate-900">Payment history</h2>
      {payments.length ? (
        <TableCard>
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Plan</th>
                <th className="hidden sm:table-cell">Reference</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p._id}>
                  <td className="whitespace-nowrap text-slate-600">{formatDateTime(p.paidAt || p.createdAt)}</td>
                  <td className="capitalize">
                    {p.planCode} <span className="text-xs text-slate-400">· {p.purpose}</span>
                  </td>
                  <td className="hidden font-mono text-xs text-slate-500 sm:table-cell">{p.reference}</td>
                  <td className="text-right font-medium tabular-nums">{formatMoney(p.amount, p.currency)}</td>
                  <td>
                    <Badge tone={STATUS_TONES[p.status]}>{p.status}</Badge>
                    {p.failureReason && p.status !== "success" ? <p className="mt-0.5 max-w-48 truncate text-xs text-slate-500">{p.failureReason}</p> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState icon={Receipt} title="No payments yet" description={isTrial ? "You're on the free trial — no payment has been taken." : "Payments will appear here."} />
        </div>
      )}
    </>
  );
}
