// Money helpers. Amounts are stored in major units (e.g. Naira) rounded to 2dp.
// Paystack amounts are converted to the subunit (kobo) only at the API edge.

export function round2(n) {
  const x = Number(n) || 0;
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

export function toSubunit(amount) {
  return Math.round(round2(amount) * 100);
}

export function fromSubunit(amount) {
  return round2((Number(amount) || 0) / 100);
}

const formatters = new Map();

export function formatMoney(amount, currency = "NGN", { compact = false } = {}) {
  const key = `${currency}:${compact}`;
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en", {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        notation: compact ? "compact" : "standard",
        maximumFractionDigits: compact ? 1 : 2,
        minimumFractionDigits: compact ? 0 : 2,
      });
    } catch {
      f = { format: (v) => `${currency} ${Number(v).toFixed(2)}` };
    }
    formatters.set(key, f);
  }
  return f.format(Number(amount) || 0);
}

/**
 * Compute POS/cart totals. Revenue excludes tax; tax is charged on the discounted subtotal.
 * @param {{quantity:number, unitPrice:number, costPrice?:number}[]} items
 * @param {{discountType?:'amount'|'percent', discountValue?:number, taxRate?:number}} opts
 */
export function computeCartTotals(items, { discountType = "amount", discountValue = 0, taxRate = 0 } = {}) {
  const subtotal = round2(items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0));
  const cost = round2(items.reduce((s, i) => s + Number(i.quantity) * Number(i.costPrice || 0), 0));
  let discount = discountType === "percent" ? (subtotal * Math.min(Math.max(Number(discountValue) || 0, 0), 100)) / 100 : Number(discountValue) || 0;
  discount = round2(Math.min(Math.max(discount, 0), subtotal));
  const taxable = round2(subtotal - discount);
  const tax = round2((taxable * Math.max(Number(taxRate) || 0, 0)) / 100);
  const total = round2(taxable + tax);
  const revenue = taxable;
  const grossProfit = round2(revenue - cost);
  return { subtotal, discount, tax, total, revenue, costOfGoods: cost, grossProfit };
}

/** Settle a payment against a total. Returns amountPaid (capped), balance and change. */
export function settlePayment(total, tendered) {
  const t = round2(total);
  const paid = round2(Math.max(Number(tendered) || 0, 0));
  const amountPaid = Math.min(paid, t);
  const balance = round2(t - amountPaid);
  const change = round2(Math.max(paid - t, 0));
  const paymentStatus = balance <= 0 ? "paid" : amountPaid > 0 ? "partial" : "unpaid";
  return { amountPaid, balance, change, paymentStatus };
}

export function marginPercent(sellingPrice, costPrice) {
  const s = Number(sellingPrice) || 0;
  if (s <= 0) return 0;
  return round2(((s - (Number(costPrice) || 0)) / s) * 100);
}
