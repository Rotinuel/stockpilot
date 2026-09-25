import Link from "next/link";
import { notFound } from "next/navigation";
import { Truck, HandCoins, Package } from "lucide-react";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { getSupplier } from "@/services/suppliers";
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

export const metadata = { title: "Supplier" };

export default async function SupplierDetailPage({ params }) {
  const session = await requireTenantSession();
  if (!sessionCan(session, "suppliers:view")) return <AccessDenied />;
  const { id } = await params;
  const { ctx } = session;
  let data;
  try {
    data = toPlain(await getSupplier(ctx, id));
  } catch {
    notFound();
  }
  const { supplier, purchases, payments, productCount } = data;
  const cur = ctx.currency;
  return (
    <>
      <PageHeader
        back={{ href: "/suppliers", label: "Suppliers" }}
        title={supplier.name}
        description={[supplier.company, supplier.phone, supplier.email].filter(Boolean).join(" · ")}
        actions={
          <PartyActions
            kind="suppliers"
            party={supplier}
            currency={cur}
            canEdit={sessionCan(session, "suppliers:manage")}
            canDelete={sessionCan(session, "suppliers:delete")}
            canPay={sessionCan(session, "suppliers:payments")}
            payLocked={!hasFeature(session.plan, "supplierBalances")}
            canWrite={session.access.canWrite}
          />
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total purchased" value={formatMoney(supplier.totalPurchases, cur)} hint={`${supplier.purchaseCount} purchases`} icon={Truck} />
        <StatCard label="You owe" value={formatMoney(supplier.balance, cur)} icon={HandCoins} tone={supplier.balance > 0 ? "red" : "green"} />
        <StatCard label="Total paid" value={formatMoney(supplier.totalPaid, cur)} tone="green" />
        <StatCard label="Products supplied" value={productCount} icon={Package} tone="purple" href={`/products?supplier=${supplier._id}`} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Purchases" action={<Link href={`/purchases?supplier=${supplier._id}`} className="text-sm font-medium text-brand-600">View all</Link>} />
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th className="hidden sm:table-cell">Date</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.length ? (
                    purchases.map((p) => (
                      <tr key={p._id}>
                        <td>
                          <Link href={`/purchases/${p._id}`} className="font-medium text-brand-700 hover:underline">
                            {p.referenceNumber}
                          </Link>
                        </td>
                        <td className="hidden text-slate-600 sm:table-cell">{formatDate(p.purchaseDate)}</td>
                        <td className="text-right tabular-nums">{formatMoney(p.total, cur)}</td>
                        <td className="text-right tabular-nums">{formatMoney(p.balance, cur)}</td>
                        <td>{p.status === "cancelled" ? <Badge tone="red">Cancelled</Badge> : <Badge tone={STATUS_TONES[p.paymentStatus]}>{p.paymentStatus}</Badge>}</td>
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
                        {p.note ? ` · ${p.note}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">Owed after: {formatMoney(p.balanceAfter, cur)}</span>
                  </li>
                ))
              ) : (
                <li className="px-5 py-6 text-center text-sm text-slate-500">No payments recorded.</li>
              )}
            </ul>
          </Card>
        </div>
        <Card>
          <CardHeader title="Details" />
          <CardBody className="divide-y divide-slate-100 py-2">
            <KeyValue label="Company" value={supplier.company || "—"} />
            <KeyValue label="Phone" value={supplier.phone || "—"} />
            <KeyValue label="Email" value={supplier.email || "—"} />
            <KeyValue label="Address" value={supplier.address || "—"} />
            <KeyValue label="Added" value={formatDate(supplier.createdAt)} />
            {supplier.notes ? <p className="pt-3 text-sm text-slate-600">{supplier.notes}</p> : null}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
