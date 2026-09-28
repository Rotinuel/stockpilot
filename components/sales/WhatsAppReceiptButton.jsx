"use client";

import { MessageCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import { formatMoney } from "@/lib/money";
import { whatsappLink } from "@/lib/phone";

export function receiptText({ sale, items, businessName, currency = "NGN" }) {
  const lines = [
    `*${businessName || "Receipt"}*`,
    `Receipt ${sale.invoiceNumber}`,
    new Date(sale.createdAt || Date.now()).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" }),
    "",
    ...items.map((i) => `${i.quantity} x ${i.name} — ${formatMoney(i.lineTotal ?? i.quantity * i.unitPrice, currency)}`),
    "",
    sale.discount ? `Discount: -${formatMoney(sale.discount, currency)}` : null,
    sale.tax ? `Tax: ${formatMoney(sale.tax, currency)}` : null,
    `*Total: ${formatMoney(sale.total, currency)}*`,
    `Paid: ${formatMoney(sale.amountPaid, currency)}`,
    sale.balance > 0 ? `Balance due: ${formatMoney(sale.balance, currency)}` : null,
    "",
    "Thank you for your patronage!",
  ];
  return lines.filter((l) => l !== null).join("\n");
}

/** Opens WhatsApp (app or web) with the receipt prefilled, addressed to the customer if we know their phone. */
export default function WhatsAppReceiptButton({ sale, items, businessName, currency, phone, size = "md" }) {
  const href = whatsappLink(phone || "", receiptText({ sale, items, businessName, currency }));
  return (
    <Button variant="outline" size={size} icon={MessageCircle} onClick={() => window.open(href, "_blank", "noopener")}>
      WhatsApp receipt
    </Button>
  );
}
