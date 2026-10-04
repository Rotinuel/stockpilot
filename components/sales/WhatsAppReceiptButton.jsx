"use client";

import { MessageCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import { formatMoney } from "@/lib/money";
import { whatsappLink } from "@/lib/phone";

const LINE = "-------------------------";
const PAY = { cash: "Cash", pos: "POS", bank_transfer: "Bank transfer", card: "Card", other: "Other", credit: "Credit" };
const q = (n) => (Number.isInteger(Number(n)) ? Number(n) : Number(n).toFixed(2).replace(/\.?0+$/, ""));

/** Plain-text receipt for WhatsApp (*bold* is WhatsApp formatting). Mirrors the printed receipt. */
export function receiptText({ sale, items = [], businessName, business, customer, location, currency = "NGN", timezone = "Africa/Lagos" }) {
  const m = (v) => formatMoney(v || 0, currency);
  const s = business?.settings || {};
  const name = business?.businessName || businessName || "Receipt";
  const address = location?.address || business?.address;
  const phone = location?.phone || business?.phone;
  const paid = sale.amountTendered || sale.amountPaid || 0;
  const status = sale.status === "cancelled" ? "CANCELLED" : sale.balance > 0 ? (sale.amountPaid > 0 ? "PART PAYMENT" : "UNPAID (ON CREDIT)") : "PAID";
  const lines = [
    `*${name}*`,
    address || null,
    phone ? `Tel: ${phone}` : null,
    LINE,
    "*SALES RECEIPT*",
    `Receipt no: ${sale.invoiceNumber}`,
    `Date: ${new Date(sale.occurredAt || sale.createdAt || Date.now()).toLocaleString("en-GB", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" })}`,
    sale.cashierName ? `Cashier: ${sale.cashierName}` : null,
    `Customer: ${customer?.name || sale.customerName || "Walk-in customer"}`,
    LINE,
    ...items.flatMap((i) => [i.name, `   ${q(i.quantity)} × ${m(i.unitPrice)} = ${m(i.lineTotal ?? i.quantity * i.unitPrice)}`]),
    LINE,
    `Subtotal: ${m(sale.subtotal)}`,
    sale.discount ? `Discount${sale.discountType === "percent" ? ` (${sale.discountValue}%)` : ""}: -${m(sale.discount)}` : null,
    sale.tax ? `${s.taxLabel || "Tax"} (${sale.taxRate}%): ${m(sale.tax)}` : null,
    `*TOTAL: ${m(sale.total)}*`,
    `Paid (${PAY[sale.paymentMethod] || sale.paymentMethod || "Cash"}): ${m(paid)}`,
    sale.change > 0 ? `Change: ${m(sale.change)}` : null,
    sale.balance > 0 ? `*Balance due: ${m(sale.balance)}*` : null,
    `*${status}*`,
    LINE,
    s.receiptFooter || "Thank you for your patronage!",
  ];
  return lines.filter((l) => l !== null && l !== undefined).join("\n");
}

/** Opens WhatsApp (app or web) with the receipt prefilled, addressed to the customer if we know their phone. */
export default function WhatsAppReceiptButton({ sale, items, businessName, business, customer, location, currency, timezone, phone, size = "md" }) {
  const href = whatsappLink(phone || "", receiptText({ sale, items, businessName, business, customer, location, currency, timezone }));
  return (
    <Button variant="outline" size={size} icon={MessageCircle} onClick={() => window.open(href, "_blank", "noopener")}>
      WhatsApp receipt
    </Button>
  );
}
