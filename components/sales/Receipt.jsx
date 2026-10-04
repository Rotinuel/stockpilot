import { formatMoney } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";

const fmtDate = (d, tz) =>
  new Date(d || Date.now()).toLocaleString("en-GB", { timeZone: tz || "Africa/Lagos", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Printable width for each paper size. Thermal printers can't print the full roll width.
export const RECEIPT_PAPER = {
  "80mm": { width: "72mm", screen: "max-w-[320px]", text: "text-[12px]" },
  "58mm": { width: "48mm", screen: "max-w-[240px]", text: "text-[11px]" },
  a4: { width: "100mm", screen: "max-w-sm", text: "text-[12.5px]" },
};

const qty = (n) => (Number.isInteger(Number(n)) ? Number(n) : Number(n).toFixed(2).replace(/\.?0+$/, ""));

/**
 * Printable sales receipt. Pure component (server or client).
 * Prints on its own (see `.print-area` in globals.css): everything else on the page is hidden
 * and the receipt is laid out at the width of the paper chosen in Settings → Tax & receipts.
 */
export default function Receipt({ sale, items = [], business, customer, location, currency = "NGN", timezone, offline = false }) {
  const s = business?.settings || {};
  const paper = RECEIPT_PAPER[s.receiptPaper] ? s.receiptPaper : "80mm";
  const p = RECEIPT_PAPER[paper];
  const money = (v) => formatMoney(v || 0, currency);
  const units = items.reduce((a, it) => a + (Number(it.quantity) || 0), 0);
  const paid = sale.amountTendered || sale.amountPaid || 0;
  const status = sale.status === "cancelled" ? null : sale.balance > 0 ? (sale.amountPaid > 0 ? "PART PAYMENT" : "UNPAID — ON CREDIT") : "PAID";
  const customerName = customer?.name || sale.customerName || "Walk-in customer";

  return (
    <div
      className={`print-area receipt mx-auto w-full ${p.screen} rounded-xl border border-slate-200 bg-white px-4 py-5 font-sans ${p.text} leading-snug text-slate-900 tabular-nums`}
      data-paper={paper}
      style={{ "--receipt-width": p.width }}
    >
      {/* Business */}
      <div className="text-center">
        {s.showLogoOnReceipt !== false && business?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={business.logo} alt="" className="mx-auto mb-2 h-12 w-12 rounded-lg object-cover" />
        ) : null}
        <p className="text-[1.25em] leading-tight font-bold break-words">{business?.businessName || "Receipt"}</p>
        {location?.address || business?.address ? <p className="mt-0.5 break-words text-slate-700">{location?.address || business.address}</p> : null}
        {location?.phone || business?.phone ? <p className="text-slate-700">Tel: {location?.phone || business.phone}</p> : null}
        {s.receiptHeader ? <p className="mt-1 break-words text-slate-700">{s.receiptHeader}</p> : null}
      </div>

      <Divider />
      <p className="text-center text-[0.95em] font-bold tracking-[0.15em]">{offline ? "SALES RECEIPT (OFFLINE)" : "SALES RECEIPT"}</p>
      <Divider />

      {/* Sale details */}
      <div className="space-y-0.5">
        <Row label="Receipt no." value={<strong>{sale.invoiceNumber}</strong>} />
        <Row label="Date" value={fmtDate(sale.occurredAt || sale.createdAt, timezone)} />
        {location?.name ? <Row label="Branch" value={location.name} /> : null}
        <Row label="Cashier" value={sale.cashierName} />
        <Row label="Customer" value={customerName} />
        {customer?.phone ? <Row label="Phone" value={customer.phone} /> : null}
      </div>
      {sale.status === "cancelled" ? <p className="mt-2 border border-current py-1 text-center font-bold tracking-widest text-rose-600">CANCELLED</p> : null}

      <Divider />

      {/* Items: name on its own line (wraps freely), then qty × price … line total */}
      <div className="flex justify-between gap-3 pb-1 text-[0.85em] font-semibold tracking-wide text-slate-500 uppercase">
        <span>Item</span>
        <span>Amount</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={String(it._id || it.productId)} className="break-inside-avoid">
            <p className="font-medium break-words">{it.name}</p>
            <p className="flex justify-between gap-3">
              <span className="text-slate-600">
                {qty(it.quantity)} × {money(it.unitPrice)}
              </span>
              <span className="whitespace-nowrap">{money(it.lineTotal)}</span>
            </p>
          </li>
        ))}
      </ul>

      <Divider />

      {/* Totals */}
      <div className="space-y-0.5">
        <Row label={`Subtotal (${items.length} item${items.length === 1 ? "" : "s"}${units !== items.length ? `, ${qty(units)} units` : ""})`} value={money(sale.subtotal)} />
        {sale.discount ? <Row label={`Discount${sale.discountType === "percent" ? ` (${sale.discountValue}%)` : ""}`} value={`−${money(sale.discount)}`} /> : null}
        {sale.tax ? <Row label={`${s.taxLabel || "Tax"} (${sale.taxRate}%)`} value={money(sale.tax)} /> : null}
      </div>
      <div className="my-1.5 border-t border-slate-900" />
      <p className="flex items-baseline justify-between gap-3 text-[1.3em] font-bold">
        <span>TOTAL</span>
        <span className="whitespace-nowrap">{money(sale.total)}</span>
      </p>
      <div className="my-1.5 border-t border-slate-900" />

      {/* Payment */}
      <div className="space-y-0.5">
        <Row label={`Paid · ${PAYMENT_METHOD_LABELS[sale.paymentMethod] || sale.paymentMethod || "Cash"}`} value={money(paid)} />
        {sale.change > 0 ? <Row label="Change" value={money(sale.change)} /> : null}
        {sale.balance > 0 ? <Row label="Balance due" value={money(sale.balance)} strong /> : null}
      </div>
      {status ? <p className="mt-2 text-center font-bold tracking-[0.2em]">*** {status} ***</p> : null}

      <Divider />
      <p className="text-center break-words whitespace-pre-line">{s.receiptFooter || "Thank you for your patronage!"}</p>
      {offline ? <p className="mt-1 text-center text-[0.85em] text-slate-500">Recorded offline — the final receipt number is issued when it syncs.</p> : null}
      <p className="mt-2 text-center text-[0.8em] text-slate-400">Powered by StockPilot</p>
    </div>
  );
}

function Divider() {
  return <div className="my-2.5 border-t border-dashed border-slate-400" />;
}

function Row({ label, value, strong }) {
  return (
    <p className={`flex items-baseline justify-between gap-3 ${strong ? "font-bold" : ""}`}>
      <span className="shrink-0 text-slate-600">{label}</span>
      <span className="min-w-0 text-right break-words">{value}</span>
    </p>
  );
}
