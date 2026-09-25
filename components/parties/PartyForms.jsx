"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, HandCoins } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useConfirm } from "@/components/ui/Confirm";
import { apiFetch, useAction } from "@/hooks/useApi";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/constants";

const LABEL = { customers: "customer", suppliers: "supplier" };

export function PartyFormModal({ kind, party, onClose, currency = "NGN" }) {
  const isEdit = Boolean(party?._id);
  const [v, setV] = useState({
    name: party?.name || "",
    phone: party?.phone || "",
    email: party?.email || "",
    address: party?.address || "",
    notes: party?.notes || "",
    company: party?.company || "",
    type: party?.type || "cash",
    creditLimit: party?.creditLimit ? String(party.creditLimit) : "",
  });
  const { run, loading, errors } = useAction();
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    const body = { name: v.name, phone: v.phone, email: v.email, address: v.address, notes: v.notes };
    if (kind === "customers") Object.assign(body, { type: v.type, creditLimit: v.creditLimit || 0 });
    else body.company = v.company;
    const res = await run(() => apiFetch(isEdit ? `/api/${kind}/${party._id}` : `/api/${kind}`, { method: isEdit ? "PATCH" : "POST", body }), {
      success: isEdit ? "Saved" : `${LABEL[kind][0].toUpperCase()}${LABEL[kind].slice(1)} added`,
      refresh: true,
    });
    if (res) onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit ${LABEL[kind]}` : `Add ${LABEL[kind]}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="party-form" loading={loading}>
            Save
          </Button>
        </>
      }
    >
      <form id="party-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Name" htmlFor="pname" error={errors.name} required className="sm:col-span-2">
          <Input id="pname" value={v.name} onChange={set("name")} required />
        </Field>
        {kind === "suppliers" ? (
          <Field label="Company" error={errors.company} className="sm:col-span-2">
            <Input value={v.company} onChange={set("company")} />
          </Field>
        ) : null}
        <Field label="Phone" error={errors.phone}>
          <Input type="tel" value={v.phone} onChange={set("phone")} />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" value={v.email} onChange={set("email")} />
        </Field>
        {kind === "customers" ? (
          <>
            <Field label="Customer type">
              <Select value={v.type} onChange={set("type")}>
                <option value="cash">Cash customer</option>
                <option value="credit">Credit customer</option>
              </Select>
            </Field>
            <Field label={`Credit limit (${currency})`} hint="0 = no limit" error={errors.creditLimit}>
              <Input type="number" min="0" step="0.01" value={v.creditLimit} onChange={set("creditLimit")} />
            </Field>
          </>
        ) : null}
        <Field label="Address" error={errors.address} className="sm:col-span-2">
          <Input value={v.address} onChange={set("address")} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={2} value={v.notes} onChange={set("notes")} />
        </Field>
      </form>
    </Modal>
  );
}

export function PaymentModal({ kind, party, onClose, currency = "NGN" }) {
  const [v, setV] = useState({ amount: String(party.balance || ""), method: "cash", note: "" });
  const { run, loading, errors } = useAction();
  const submit = async (e) => {
    e.preventDefault();
    const res = await run(() => apiFetch(`/api/${kind}/${party._id}/payments`, { method: "POST", body: v }), { success: "Payment recorded", refresh: true });
    if (res) onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={kind === "customers" ? `Receive payment from ${party.name}` : `Pay ${party.name}`}
      description={`Outstanding balance: ${formatMoney(party.balance, currency)}. Payments are applied to the oldest unpaid ${kind === "customers" ? "sales" : "purchases"} first.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="pay-form" loading={loading}>
            Record payment
          </Button>
        </>
      }
    >
      <form id="pay-form" onSubmit={submit} className="space-y-4">
        <Field label={`Amount (${currency})`} error={errors.amount}>
          <Input type="number" min="0" step="0.01" max={party.balance} value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} required />
        </Field>
        <Field label="Method">
          <Select value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note">
          <Input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="e.g. Transfer ref 12345" />
        </Field>
      </form>
    </Modal>
  );
}

export function AddPartyButton({ kind, currency, disabled }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)} disabled={disabled}>
        Add {LABEL[kind]}
      </Button>
      {open ? <PartyFormModal kind={kind} onClose={() => setOpen(false)} currency={currency} /> : null}
    </>
  );
}

export function PartyActions({ kind, party, currency, canEdit, canDelete, canPay, canWrite, payLocked }) {
  const [modal, setModal] = useState(null);
  const confirm = useConfirm();
  const router = useRouter();
  const { run } = useAction();
  const remove = async () => {
    const ok = await confirm({ title: `Delete ${party.name}?`, message: "Their history is kept for reports, but they'll no longer appear in lists.", confirmLabel: "Delete", tone: "danger" });
    if (!ok) return;
    const res = await run(() => apiFetch(`/api/${kind}/${party._id}`, { method: "DELETE" }), { success: "Deleted" });
    if (res) router.push(`/${kind}`);
  };
  return (
    <>
      {canPay && party.balance > 0 ? (
        <Button icon={HandCoins} onClick={() => setModal("pay")} disabled={!canWrite || payLocked} title={payLocked ? "Available on the Business plan" : undefined}>
          {kind === "customers" ? "Receive payment" : "Record payment"}
        </Button>
      ) : null}
      {canEdit ? (
        <Button variant="outline" icon={Pencil} onClick={() => setModal("edit")} disabled={!canWrite}>
          Edit
        </Button>
      ) : null}
      {canDelete ? (
        <Button variant="danger-outline" icon={Trash2} onClick={remove} disabled={!canWrite}>
          Delete
        </Button>
      ) : null}
      {modal === "edit" ? <PartyFormModal kind={kind} party={party} onClose={() => setModal(null)} currency={currency} /> : null}
      {modal === "pay" ? <PaymentModal kind={kind} party={party} onClose={() => setModal(null)} currency={currency} /> : null}
    </>
  );
}
