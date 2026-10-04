import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { getSale } from "@/services/sales";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/utils/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { toPlain } from "@/lib/serialize";
import { PageHeader, KeyValue, Alert } from "@/components/ui/Misc";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Badge, { STATUS_TONES } from "@/components/ui/Badge";
import Receipt from "@/components/sales/Receipt";
import { PrintButton, CancelSaleButton } from "@/components/sales/SaleActions";
import WhatsAppReceiptButton from "@/components/sales/WhatsAppReceiptButton";
import AccessDenied from "@/components/layout/AccessDenied";

export const metadata = { title: "Sale" };

export default async function SaleDetailPage({ params }) {
  const session = await requireTenantSession();
  if (!sessionCan(session, "sales:view")) return <AccessDenied />;
  const { id } = await params;
  const { ctx } = session;
  let data;
  try {
    data = toPlain(await getSale(ctx, id));
  } catch (err) {
    if (err?.status === 403) return <AccessDenied message={err.message} />;
    notFound();
  }
  const { sale, items, customer, business, location } = data;
  const canSeeProfit = sessionCan(session, "dashboard:financials");

  return (
    <>
      <PageHeader
        back={{ href: "/sales", label: "Sales" }}
        title={`Sale ${sale.invoiceNumber}`}
        description={formatDateTime(sale.createdAt, { timeZone: ctx.timezone })}
        actions={
          <>
            <WhatsAppReceiptButton sale={sale} items={items} business={business} customer={customer} location={location} currency={ctx.currency} timezone={ctx.timezone} phone={customer?.phone} />
            <PrintButton />
            {sessionCan(session, "sales:cancel") && sale.status === "completed" ? <CancelSaleButton saleId={sale._id} invoiceNumber={sale.invoiceNumber} disabled={!session.access.canWrite} /> : null}
          </>
        }
      />
      {sale.status === "cancelled" ? (
        <Alert tone="danger" className="mb-6" title="This sale was cancelled">
          {sale.cancelReason ? `Reason: ${sale.cancelReason}. ` : ""}Stock was returned on {formatDateTime(sale.cancelledAt, { timeZone: ctx.timezone })}.
        </Alert>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Items" />
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Total</th>
                    {canSeeProfit ? <th className="hidden text-right sm:table-cell">Profit</th> : null}
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
                      <td className="text-right tabular-nums">{formatMoney(it.unitPrice, ctx.currency)}</td>
                      <td className="text-right font-medium tabular-nums">{formatMoney(it.lineTotal, ctx.currency)}</td>
                      {canSeeProfit ? <td className="hidden text-right text-emerald-700 tabular-nums sm:table-cell">{formatMoney(it.lineTotal - it.lineCost, ctx.currency)}</td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <CardHeader title="Summary" />
            <CardBody className="grid gap-x-8 divide-slate-100 sm:grid-cols-2">
              <div className="divide-y divide-slate-100">
                <KeyValue label="Status" value={<Badge tone={STATUS_TONES[sale.status]}>{sale.status}</Badge>} />
                <KeyValue label="Payment" value={<Badge tone={STATUS_TONES[sale.paymentStatus]}>{sale.paymentStatus}</Badge>} />
                <KeyValue label="Method" value={PAYMENT_METHOD_LABELS[sale.paymentMethod]} />
                <KeyValue label="Cashier" value={sale.cashierName} />
                <KeyValue
                  label="Customer"
                  value={
                    customer ? (
                      <Link href={`/customers/${customer._id}`} className="text-brand-700 hover:underline">
                        {customer.name}
                      </Link>
                    ) : (
                      sale.customerName
                    )
                  }
                />
                {location ? <KeyValue label="Location" value={location.name} /> : null}
              </div>
              <div className="divide-y divide-slate-100">
                <KeyValue label="Subtotal" value={formatMoney(sale.subtotal, ctx.currency)} />
                <KeyValue label="Discount" value={formatMoney(sale.discount, ctx.currency)} />
                <KeyValue label={`Tax (${sale.taxRate}%)`} value={formatMoney(sale.tax, ctx.currency)} />
                <KeyValue label="Total" value={formatMoney(sale.total, ctx.currency)} />
                <KeyValue label="Paid" value={formatMoney(sale.amountPaid, ctx.currency)} />
                <KeyValue label="Balance" value={formatMoney(sale.balance, ctx.currency)} />
                {canSeeProfit ? <KeyValue label="Gross profit" value={formatMoney(sale.grossProfit, ctx.currency)} /> : null}
              </div>
            </CardBody>
          </Card>
        </div>
        <div>
          <Receipt sale={sale} items={items} business={business} customer={customer} location={location} currency={ctx.currency} timezone={ctx.timezone} />
        </div>
      </div>
    </>
  );
}
