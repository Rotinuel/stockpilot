import { requireSuperAdminSession } from "@/lib/session";
import { listPlansWithCounts } from "@/services/admin";
import { isPaystackConfigured } from "@/lib/paystack";
import { toPlain } from "@/lib/serialize";
import { formatMoney } from "@/lib/money";
import { limitLabel } from "@/lib/plans";
import { PLAN_FEATURE_LABELS } from "@/lib/constants";
import { PageHeader, TableCard, Alert } from "@/components/ui/Misc";
import Badge from "@/components/ui/Badge";
import { NewPlanButton, PlanRowActions } from "@/components/admin/PlanEditor";

export const metadata = { title: "Plans & pricing" };

export default async function PlansPage() {
  await requireSuperAdminSession();
  const plans = toPlain(await listPlansWithCounts());
  const configured = isPaystackConfigured();
  return (
    <>
      <PageHeader title="Plans & pricing" description="Prices, limits and features are read from here everywhere in the app." actions={<NewPlanButton />} />
      {!configured ? (
        <Alert tone="warning" className="mb-6" title="Paystack keys missing">
          Set PAYSTACK_SECRET_KEY to create plans on Paystack and accept payments.
        </Alert>
      ) : null}
      <TableCard>
        <table className="table-base">
          <thead>
            <tr>
              <th>Plan</th>
              <th className="text-right">Price</th>
              <th className="hidden md:table-cell">Limits</th>
              <th className="hidden xl:table-cell">Features</th>
              <th className="hidden sm:table-cell">Businesses</th>
              <th className="hidden lg:table-cell">Paystack</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p._id} className={p.isActive ? "" : "opacity-60"}>
                <td>
                  <p className="font-medium text-slate-900">
                    {p.name} {p.isTrial ? <Badge tone="blue">Trial</Badge> : null} {p.highlight ? <Badge tone="brand">Popular</Badge> : null} {!p.isActive ? <Badge tone="gray">Inactive</Badge> : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.code} · {p.isTrial ? `${p.durationDays} days` : p.interval}
                  </p>
                </td>
                <td className="text-right font-medium tabular-nums">{formatMoney(p.price, p.currency)}</td>
                <td className="hidden text-xs text-slate-600 md:table-cell">
                  {limitLabel(p.limits.products)} products · {limitLabel(p.limits.staffUsers)} staff · {limitLabel(p.limits.locations)} locations
                </td>
                <td className="hidden max-w-64 text-xs text-slate-600 xl:table-cell">
                  {Object.entries(p.features || {})
                    .filter(([, on]) => on)
                    .map(([k]) => PLAN_FEATURE_LABELS[k])
                    .join(", ") || "Basic"}
                </td>
                <td className="hidden tabular-nums sm:table-cell">{p.tenantCount}</td>
                <td className="hidden font-mono text-xs text-slate-500 lg:table-cell">{p.paystackPlanCode || "—"}</td>
                <td>
                  <PlanRowActions plan={p} paystackConfigured={configured} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}
