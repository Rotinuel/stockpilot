"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { apiFetch, useAction } from "@/hooks/useApi";

const ACTIONS = [
  { value: "add", label: "Add stock (received / found)", sign: "+" },
  { value: "remove", label: "Remove stock (lost / used)", sign: "−" },
  { value: "damage", label: "Damaged / expired", sign: "−" },
  { value: "return", label: "Customer return (back to shelf)", sign: "+" },
  { value: "set", label: "Stock count — set exact quantity", sign: "=" },
];

export default function StockAdjustModal({ open, onClose, product, locations = [] }) {
  const [values, setValues] = useState({ action: "add", quantity: "", reason: "", locationId: locations.find((l) => l.isDefault)?._id || "" });
  const { run, loading, errors } = useAction();
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const current = Number(product.quantity) || 0;
  const q = Number(values.quantity) || 0;
  const preview = values.action === "set" ? q : ["add", "return"].includes(values.action) ? current + q : current - q;

  const submit = async (e) => {
    e.preventDefault();
    const res = await run(
      () =>
        apiFetch("/api/inventory/adjust", {
          method: "POST",
          body: { productId: product._id, action: values.action, quantity: values.quantity, reason: values.reason, locationId: values.locationId || undefined },
        }),
      { success: "Stock updated", successMessage: `${product.name}: ${res_label(values.action)}`, refresh: true },
    );
    if (res) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Adjust stock — ${product.name}`}
      description="Every adjustment is saved to the inventory history with your name and reason."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="adjust-form" loading={loading}>
            Save adjustment
          </Button>
        </>
      }
    >
      <form id="adjust-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Type of change" htmlFor="action">
          <Select id="action" value={values.action} onChange={set("action")}>
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
        {locations.length > 1 ? (
          <Field label="Location" htmlFor="locationId">
            <Select id="locationId" value={values.locationId} onChange={set("locationId")}>
              {locations.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label={values.action === "set" ? "Counted quantity" : "Quantity"} htmlFor="quantity" error={errors.quantity}>
          <Input id="quantity" type="number" min="0" step="any" inputMode="decimal" value={values.quantity} onChange={set("quantity")} required />
        </Field>
        <Field label="Reason" htmlFor="reason" error={errors.reason} hint="e.g. Carton damaged in transit, monthly stock count">
          <Textarea id="reason" value={values.reason} onChange={set("reason")} rows={2} />
        </Field>
        <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
          Current total: <strong>{current}</strong> {product.unit} → after change: <strong className={preview < 0 ? "text-rose-600" : "text-slate-900"}>{preview}</strong> {product.unit}
          {locations.length > 1 ? <span className="block text-xs text-slate-500">(Totals across all locations; the change applies to the selected location.)</span> : null}
        </div>
      </form>
    </Modal>
  );
}

function res_label(action) {
  return ACTIONS.find((a) => a.value === action)?.label || "Adjusted";
}
