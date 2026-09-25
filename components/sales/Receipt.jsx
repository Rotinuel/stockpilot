import { formatMoney } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";

const fmtDate = (d, tz) =>
  new Date(d).toLocaleString("en-GB", { timeZone: tz || "Africa/Lagos", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Printable 80mm-style receipt. Pure component (server or client). */
export default function Receipt({ sale, items, business, customer, location, currency = "NGN", timezone }) {
  const s = business?.settings || {};
  return (
    <div className="print-area mx-auto w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 font-mono text-[12.5px] leading-relaxed text-slate-800">
      <div className="text-center">
        {s.showLogoOnReceipt !== false && business?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={business.logo} alt="" className="mx-auto mb-2 h-12 w-12 rounded-lg object-cover" />
        ) : null}
        <p className="font-sans text-base font-bold">{business?.businessName}</p>
        {location?.address || business?.address ? <p>{location?.address || business.address}</p> : null}
        {business?.phone ? <p>Tel: {business.phone}</p> : null}
        {s.receiptHeader ? <p className="mt-1">{s.receiptHeader}</p> : null}
      </div>
      <div className="my-3 border-t border-dashed border-slate-300" />
      <div className="space-y-0.5">
        <p className="flex justify-between">
          <span>Receipt</span>
          <strong>{sale.invoiceNumber}</strong>
        </p>
        <p className="flex justify-between">
          <span>Date</span>
          <span>{fmtDate(sale.createdAt, timezone)}</span>
        </p>
        <p className="flex justify-between">
          <span>Cashier</span>
          <span>{sale.cashierName}</span>
        </p>
        <p className="flex justify-between">
          <span>Customer</span>
          <span className="truncate pl-3">{customer?.name || sale.customerName}</span>
        </p>
        {sale.status === "cancelled" ? <p className="mt-1 text-center font-bold text-rose-600">*** CANCELLED ***</p> : null}
      </div>
      <div className="my-3 border-t border-dashed border-slate-300" />
      <table className="w-full">
        <tbody>
          {items.map((it) => (
            <tr key={String(it._id || it.productId)} className="align-top">
              <td className="pb-1.5">
                <span className="block">{it.name}</span>
                <span className="text-slate-500">
                  {it.quantity} × {formatMoney(it.unitPrice, currency)}
                </span>
              </td>
              <td className="pb-1.5 text-right whitespace-nowrap">{formatMoney(it.lineTotal, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="my-3 border-t border-dashed border-slate-300" />
      <div className="space-y-0.5">
        <Row label="Subtotal" value={formatMoney(sale.subtotal, currency)} />
        {sale.discount ? <Row label={`Discount${sale.discountType === "percent" ? ` (${sale.discountValue}%)` : ""}`} value={`-${formatMoney(sale.discount, currency)}`} /> : null}
        {sale.tax ? <Row label={`${s.taxLabel || "Tax"} (${sale.taxRate}%)`} value={formatMoney(sale.tax, currency)} /> : null}
        <p className="flex justify-between pt-1 font-sans text-base font-bold">
          <span>TOTAL</span>
          <span>{formatMoney(sale.total, currency)}</span>
        </p>
        <Row label={`Paid (${PAYMENT_METHOD_LABELS[sale.paymentMethod] || sale.paymentMethod})`} value={formatMoney(sale.amountTendered || sale.amountPaid, currency)} />
        {sale.change ? <Row label="Change" value={formatMoney(sale.change, currency)} /> : null}
        {sale.balance > 0 ? <Row label="Balance due" value={formatMoney(sale.balance, currency)} strong /> : null}
      </div>
      <div className="my-3 border-t border-dashed border-slate-300" />
      <p className="text-center">{s.receiptFooter || "Thank you for your patronage!"}</p>
      <p className="mt-1 text-center text-[10px] text-slate-400">Powered by StockPilot</p>
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <p className={`flex justify-between ${strong ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </p>
  );
}
