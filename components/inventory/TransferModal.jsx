"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import ProductPicker from "@/components/inventory/ProductPicker";
import { apiFetch, useAction } from "@/hooks/useApi";

export default function TransferModal({ open, onClose, locations = [] }) {
  const active = locations.filter((l) => l.isActive !== false);
  const [product, setProduct] = useState(null);
  const [values, setValues] = useState({ fromLocationId: active[0]?._id || "", toLocationId: active[1]?._id || "", quantity: "", reason: "" });
  const { run, loading, errors } = useAction();
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (!product) return;
    const res = await run(() => apiFetch("/api/inventory/transfer", { method: "POST", body: { ...values, productId: product.id } }), { success: "Stock transferred", refresh: true });
    if (res) onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transfer stock between locations"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="transfer-form" loading={loading} disabled={!product}>
            Transfer
          </Button>
        </>
      }
    >
      <form id="transfer-form" onSubmit={submit} className="space-y-4">
        <Field label="Product">
          <ProductPicker value={product} onChange={setProduct} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From" error={errors.fromLocationId}>
            <Select value={values.fromLocationId} onChange={set("fromLocationId")}>
              {active.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="To" error={errors.toLocationId}>
            <Select value={values.toLocationId} onChange={set("toLocationId")}>
              {active.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Quantity" error={errors.quantity}>
          <Input type="number" min="0" step="any" value={values.quantity} onChange={set("quantity")} required />
        </Field>
        <Field label="Note">
          <Textarea rows={2} value={values.reason} onChange={set("reason")} />
        </Field>
      </form>
    </Modal>
  );
}
