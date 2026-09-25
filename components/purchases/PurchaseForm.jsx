"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/Field";
import ProductPicker from "@/components/inventory/ProductPicker";
import { apiFetch, useAction } from "@/hooks/useApi";
import { formatMoney, round2, settlePayment } from "@/lib/money";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/constants";

export default function PurchaseForm({ suppliers, locations, currency, allowBalance }) {
  const router = useRouter();
  const [lines, setLines] = useState([]);
  const [meta, setMeta] = useState({
    supplierId: "",
    invoiceNumber: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    otherCharges: "",
    amountPaid: "",
    paymentMethod: "bank_transfer",
    notes: "",
    updateCostPrice: true,
    locationId: locations.find((l) => l.isDefault)?._id || locations[0]?._id || "",
  });
  const { run, loading, errors } = useAction();
  const set = (k) => (e) => setMeta((m) => ({ ...m, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const addProduct = async (p) => {
    if (!p) return;
    if (lines.some((l) => l.productId === p.id)) return;
    let cost = "";
    try {
      const res = await apiFetch(`/api/products/${p.id}`);
      cost = String(res.product.costPrice ?? "");
    } catch {}
    setLines((ls) => [...ls, { productId: p.id, name: p.name, sku: p.sku, unit: p.unit, quantity: "1", unitCost: cost, sellingPrice: "" }]);
  };
  const updateLine = (idx, k, v) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, [k]: v } : l)));

  const subtotal = useMemo(() => round2(lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0)), [lines]);
  const total = round2(subtotal + (Number(meta.otherCharges) || 0));
  const paid = meta.amountPaid === "" ? total : Number(meta.amountPaid) || 0;
  const pay = settlePayment(total, paid);

  const submit = async (e) => {
    e.preventDefault();
    if (!lines.length) return;
    const res = await run(
      () =>
        apiFetch("/api/purchases", {
          method: "POST",
          body: {
            supplierId: meta.supplierId || undefined,
            invoiceNumber: meta.invoiceNumber,
            purchaseDate: meta.purchaseDate,
            otherCharges: meta.otherCharges || 0,
            amountPaid: paid,
            paymentMethod: meta.paymentMethod,
            notes: meta.notes,
            updateCostPrice: meta.updateCostPrice,
            locationId: meta.locationId || undefined,
            items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitCost: l.unitCost || 0, sellingPrice: l.sellingPrice || undefined })),
          },
        }),
      { success: "Purchase recorded", successMessage: "Stock has been increased." },
    );
    if (res) {
      router.push(`/purchases/${res.purchase._id}`);
      router.refresh();
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader title="Items received" description="Search products to add them. Quantities are added to stock when you save." />
        <CardBody className="space-y-4">
          <ProductPicker onChange={addProduct} clearOnSelect placeholder="Add product — search name, SKU or barcode" />
          {errors.items ? <p className="text-sm text-rose-600">{errors.items}</p> : null}
          {lines.length ? (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="w-24">Qty</th>
                    <th className="w-32">Unit cost</th>
                    <th className="hidden w-32 md:table-cell">New sell price</th>
                    <th className="text-right">Line total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.productId}>
                      <td>
                        <p className="font-medium text-slate-900">{l.name}</p>
                        <p className="text-xs text-slate-500">{l.sku}</p>
                      </td>
                      <td>
                        <Input type="number" min="0" step="any" value={l.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} className="h-9" aria-label="Quantity" />
                      </td>
                      <td>
                        <Input type="number" min="0" step="0.01" value={l.unitCost} onChange={(e) => updateLine(i, "unitCost", e.target.value)} className="h-9" aria-label="Unit cost" />
                      </td>
                      <td className="hidden md:table-cell">
                        <Input type="number" min="0" step="0.01" placeholder="Keep" value={l.sellingPrice} onChange={(e) => updateLine(i, "sellingPrice", e.target.value)} className="h-9" aria-label="New selling price" />
                      </td>
                      <td className="text-right font-medium tabular-nums">{formatMoney((Number(l.quantity) || 0) * (Number(l.unitCost) || 0), currency)}</td>
                      <td>
                        <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove line">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 py-10 text-sm text-slate-500">
              <Plus className="mb-2 h-6 w-6 text-slate-300" /> No items yet — search above to add products.
            </div>
          )}
        </CardBody>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Purchase details" />
          <CardBody className="space-y-4">
            <Field label="Supplier" error={errors.supplierId}>
              <Select value={meta.supplierId} onChange={set("supplierId")}>
                <option value="">Unspecified</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Supplier invoice #">
                <Input value={meta.invoiceNumber} onChange={set("invoiceNumber")} />
              </Field>
              <Field label="Date">
                <Input type="date" value={meta.purchaseDate} onChange={set("purchaseDate")} />
              </Field>
            </div>
            {locations.length > 1 ? (
              <Field label="Receive into location">
                <Select value={meta.locationId} onChange={set("locationId")}>
                  {locations.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label={`Other charges (${currency})`} hint="Transport, loading, etc.">
              <Input type="number" min="0" step="0.01" value={meta.otherCharges} onChange={set("otherCharges")} />
            </Field>
            <Checkbox checked={meta.updateCostPrice} onChange={set("updateCostPrice")} label="Update product cost prices" description="Use these unit costs as the new cost price for profit calculations." />
            <Field label="Notes">
              <Textarea rows={2} value={meta.notes} onChange={set("notes")} />
            </Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Payment" />
          <CardBody className="space-y-4">
            <div className="space-y-1 text-sm">
              <p className="flex justify-between text-slate-600">
                <span>Items</span>
                <span>{formatMoney(subtotal, currency)}</span>
              </p>
              <p className="flex justify-between text-slate-600">
                <span>Other charges</span>
                <span>{formatMoney(Number(meta.otherCharges) || 0, currency)}</span>
              </p>
              <p className="flex justify-between text-base font-bold text-slate-900">
                <span>Total</span>
                <span>{formatMoney(total, currency)}</span>
              </p>
            </div>
            <Field label="Amount paid now" hint={allowBalance ? "Leave empty if paid in full. Less than the total is added to what you owe the supplier." : "Supplier balances are available on the Business plan."} error={errors.amountPaid}>
              <Input type="number" min="0" step="0.01" placeholder={String(total)} value={meta.amountPaid} onChange={set("amountPaid")} />
            </Field>
            <Field label="Paid via">
              <Select value={meta.paymentMethod} onChange={set("paymentMethod")}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            </Field>
            {pay.balance > 0 ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">You will owe {formatMoney(pay.balance, currency)}</p> : null}
            <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!lines.length}>
              Save purchase
            </Button>
          </CardBody>
        </Card>
      </div>
    </form>
  );
}
