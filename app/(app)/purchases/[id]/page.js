import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { getPurchase } from "@/services/purchases";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/utils/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { toPlain } from "@/lib/serialize";
import { PageHeader, KeyValue, Alert } from "@/components/ui/Misc";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Badge, { STATUS_TONES } from "@/components/ui/Badge";
import { PrintButton } from "@/components/sales/SaleActions";
import CancelPurchaseButton from "@/components/purchases/CancelPurchaseButton";
import AccessDenied from "@/components/layout/AccessDenied";

export const metadata = { title: "Purchase" };

export default async function PurchaseDetailPage({ params }) {
  const session = await requireTenantSession();
  if (!sessionCan(session, "purchases:view")) return <AccessDenied />;
  const { id } = await params;
  const { ctx } = session;
  let data;
  try {
    data = toPlain(await getPurchase(ctx, id));
  } catch {
    notFound();
  }
  const { purchase, items, supplier, location } = data;
  return (
    <>
      <PageHeader
        back={{ href: "/purchases", label: "Purchases" }}
        title={`Purchase ${purchase.referenceNumber}`}
        description={`${purchase.supplierName} · ${formatDate(purchase.purchaseDate)}`}
        actions={
          <>
            <PrintButton label="Print" />
            {sessionCan(session, "purchases:cancel") && purchase.status === "completed" ? <CancelPurchaseButton id={purchase._id} reference={purchase.referenceNumber} disabled={!session.access.canWrite} /> : null}
          </>
        }
      />
      {purchase.status === "cancelled" ? (
        <Alert tone="danger" className="mb-6" title="This purchase was cancelled">
          Stock was removed on {formatDateTime(purchase.cancelledAt)}.
        </Alert>
      ) : null}
      <div className="print-area grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="Items" />
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Unit cost</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it._id}>
                    <td>
                      <Link href={`/products/${it.productId}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {it.name}
                      </Link>
                      <p className="text-xs text-slate-500">{it.sku}</p>
                    </td>
                    <td className="text-right tabular-nums">
                      {it.quantity} {it.unit}
                    </td>
                    <td className="text-right tabular-nums">{formatMoney(it.unitCost, ctx.currency)}</td>
                    <td className="text-right font-medium tabular-nums">{formatMoney(it.lineTotal, ctx.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardHeader title="Summary" />
          <CardBody className="divide-y divide-slate-100 py-2">
            <KeyValue label="Status" value={<Badge tone={STATUS_TONES[purchase.status]}>{purchase.status}</Badge>} />
            <KeyValue
              label="Supplier"
              value={
                supplier ? (
                  <Link href={`/suppliers/${supplier._id}`} className="text-brand-700 hover:underline">
                    {supplier.name}
                  </Link>
                ) : (
                  purchase.supplierName
                )
              }
            />
            {purchase.invoiceNumber ? <KeyValue label="Supplier invoice" value={purchase.invoiceNumber} /> : null}
            {location ? <KeyValue label="Received at" value={location.name} /> : null}
            <KeyValue label="Items" value={formatMoney(purchase.subtotal, ctx.currency)} />
            <KeyValue label="Other charges" value={formatMoney(purchase.otherCharges, ctx.currency)} />
            <KeyValue label="Total" value={<strong>{formatMoney(purchase.total, ctx.currency)}</strong>} />
            <KeyValue label={`Paid (${PAYMENT_METHOD_LABELS[purchase.paymentMethod] || purchase.paymentMethod})`} value={formatMoney(purchase.amountPaid, ctx.currency)} />
            <KeyValue label="Balance owed" value={<Badge tone={STATUS_TONES[purchase.paymentStatus]}>{formatMoney(purchase.balance, ctx.currency)}</Badge>} />
            <KeyValue label="Recorded by" value={purchase.createdByName} />
            {purchase.notes ? <p className="pt-3 text-sm text-slate-600">{purchase.notes}</p> : null}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
