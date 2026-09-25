import Link from "next/link";
import { notFound } from "next/navigation";
import { Receipt, HandCoins } from "lucide-react";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { getCustomer } from "@/services/customers";
import { hasFeature } from "@/lib/plans";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/utils/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { toPlain } from "@/lib/serialize";
import { PageHeader, StatCard, KeyValue } from "@/components/ui/Misc";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Badge, { STATUS_TONES } from "@/components/ui/Badge";
import { PartyActions } from "@/components/parties/PartyForms";
import AccessDenied from "@/components/layout/AccessDenied";

export const metadata = { title: "Customer" };

export default async function CustomerDetailPage({ params }) {
  const session = await requireTenantSession();
  if (!sessionCan(session, "customers:view")) return <AccessDenied />;
  const { id } = await params;
  const { ctx } = session;
  let data;
  try {
    data = toPlain(await getCustomer(ctx, id));
  } catch {
    notFound();
  }
  const { customer, recentSales, openSales, payments } = data;
  const cur = ctx.currency;
  return (
    <>
      <PageHeader
        back={{ href: "/customers", label: "Customers" }}
        title={customer.name}
        description={[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact details"}
        actions={
          <PartyActions
            kind="customers"
            party={customer}
            currency={cur}
            canEdit={sessionCan(session, "customers:update")}
            canDelete={sessionCan(session, "customers:delete")}
            canPay={sessionCan(session, "customers:payments")}
            payLocked={!hasFeature(session.plan, "customerBalances")}
            canWrite={session.access.canWrite}
          />
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total purchases" value={formatMoney(customer.totalPurchases, cur)} hint={`${customer.purchaseCount} sales`} icon={Receipt} />
        <StatCard label="Outstanding balance" value={formatMoney(customer.balance, cur)} icon={HandCoins} tone={customer.balance > 0 ? "yellow" : "green"} />
        <StatCard label="Total paid" value={formatMoney(customer.totalPaid, cur)} tone="green" />
        <StatCard label="Last purchase" value={customer.lastPurchaseAt ? formatDate(customer.lastPurchaseAt) : "Never"} tone="gray" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Purchase history" description="Most recent 20 sales" action={<Link href={`/sales?customer=${customer._id}`} className="text-sm font-medium text-brand-600">View all</Link>} />
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th className="hidden sm:table-cell">Date</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.length ? (
                    recentSales.map((s) => (
                      <tr key={s._id}>
                        <td>
                          <Link href={`/sales/${s._id}`} className="font-medium text-brand-700 hover:underline">
                            {s.invoiceNumber}
                          </Link>
                        </td>
                        <td className="hidden text-slate-600 sm:table-cell">{formatDateTime(s.createdAt, { timeZone: ctx.timezone })}</td>
                        <td className="text-right tabular-nums">{formatMoney(s.total, cur)}</td>
                        <td className="text-right tabular-nums">{formatMoney(s.balance, cur)}</td>
                        <td>{s.status === "cancelled" ? <Badge tone="red">Cancelled</Badge> : <Badge tone={STATUS_TONES[s.paymentStatus]}>{s.paymentStatus}</Badge>}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No purchases yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <CardHeader title="Payment history" />
            <ul className="divide-y divide-slate-100">
              {payments.length ? (
                payments.map((p) => (
                  <li key={p._id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{formatMoney(p.amount, cur)} · {PAYMENT_METHOD_LABELS[p.method]}</p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(p.createdAt, { timeZone: ctx.timezone })} · by {p.recordedByName}
                        {p.allocations?.length ? ` · applied to ${p.allocations.map((a) => a.referenceNumber).join(", ")}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">Balance after: {formatMoney(p.balanceAfter, cur)}</span>
                  </li>
                ))
              ) : (
                <li className="px-5 py-6 text-center text-sm text-slate-500">No payments recorded.</li>
              )}
            </ul>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="divide-y divide-slate-100 py-2">
              <KeyValue label="Type" value={<Badge tone={customer.type === "credit" ? "purple" : "gray"}>{customer.type}</Badge>} />
              <KeyValue label="Credit limit" value={customer.creditLimit ? formatMoney(customer.creditLimit, cur) : "None"} />
              <KeyValue label="Address" value={customer.address || "—"} />
              <KeyValue label="Customer since" value={formatDate(customer.createdAt)} />
              {customer.notes ? <p className="pt-3 text-sm text-slate-600">{customer.notes}</p> : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Unpaid sales" />
            <ul className="divide-y divide-slate-100">
              {openSales.length ? (
                openSales.map((s) => (
                  <li key={s._id} className="flex justify-between px-5 py-2.5 text-sm">
                    <Link href={`/sales/${s._id}`} className="text-brand-700 hover:underline">
                      {s.invoiceNumber}
                    </Link>
                    <span className="font-medium tabular-nums">{formatMoney(s.balance, cur)}</span>
                  </li>
                ))
              ) : (
                <li className="px-5 py-6 text-center text-sm text-slate-500">Nothing outstanding.</li>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
