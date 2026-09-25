import { describe, expect, test } from "bun:test";
import { computeCartTotals, settlePayment, round2, toSubunit, fromSubunit, marginPercent } from "../../lib/money.js";

describe("Cart totals & profit", () => {
  const items = [
    { quantity: 2, unitPrice: 320, costPrice: 240 },
    { quantity: 1, unitPrice: 800, costPrice: 640 },
  ];

  test("subtotal, tax on discounted amount, total", () => {
    const t = computeCartTotals(items, { discountType: "amount", discountValue: 40, taxRate: 7.5 });
    expect(t.subtotal).toBe(1440);
    expect(t.discount).toBe(40);
    expect(t.tax).toBe(105); // 7.5% of 1400
    expect(t.total).toBe(1505);
  });

  test("gross profit = revenue (excl. tax) − cost of goods", () => {
    const t = computeCartTotals(items, { taxRate: 7.5 });
    expect(t.revenue).toBe(1440);
    expect(t.costOfGoods).toBe(1120);
    expect(t.grossProfit).toBe(320);
  });

  test("percent discount is capped at 100% and never negative", () => {
    expect(computeCartTotals(items, { discountType: "percent", discountValue: 10 }).discount).toBe(144);
    expect(computeCartTotals(items, { discountType: "percent", discountValue: 150 }).discount).toBe(1440);
    expect(computeCartTotals(items, { discountType: "amount", discountValue: -50 }).discount).toBe(0);
    expect(computeCartTotals(items, { discountType: "amount", discountValue: 99999 }).total).toBe(0);
  });

  test("payment settlement: change, partial and unpaid", () => {
    expect(settlePayment(1505, 2000)).toEqual({ amountPaid: 1505, balance: 0, change: 495, paymentStatus: "paid" });
    expect(settlePayment(1505, 1000)).toEqual({ amountPaid: 1000, balance: 505, change: 0, paymentStatus: "partial" });
    expect(settlePayment(1505, 0).paymentStatus).toBe("unpaid");
  });

  test("rounding and Paystack subunits", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(toSubunit(5000)).toBe(500000);
    expect(toSubunit(1234.565)).toBe(123457);
    expect(fromSubunit(500000)).toBe(5000);
    expect(marginPercent(320, 240)).toBe(25);
  });
});
