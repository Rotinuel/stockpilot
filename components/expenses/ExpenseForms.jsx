"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Field";
import { useConfirm } from "@/components/ui/Confirm";
import { apiFetch, useAction } from "@/hooks/useApi";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/constants";

function ExpenseModal({ expense, onClose, currency }) {
  const isEdit = Boolean(expense?._id);
  const [v, setV] = useState({
    category: expense?.category || "rent",
    description: expense?.description || "",
    amount: expense?.amount ? String(expense.amount) : "",
    paymentMethod: expense?.paymentMethod || "cash",
    date: (expense?.date ? new Date(expense.date) : new Date()).toISOString().slice(0, 10),
    reference: expense?.reference || "",
  });
  const { run, loading, errors } = useAction();
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    const res = await run(() => apiFetch(isEdit ? `/api/expenses/${expense._id}` : "/api/expenses", { method: isEdit ? "PATCH" : "POST", body: v }), {
      success: isEdit ? "Expense updated" : "Expense recorded",
      refresh: true,
    });
    if (res) onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "Edit expense" : "Record expense"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="expense-form" loading={loading}>
            Save
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Category" error={errors.category}>
          <Select value={v.category} onChange={set("category")}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`Amount (${currency})`} error={errors.amount} required>
          <Input type="number" min="0" step="0.01" inputMode="decimal" value={v.amount} onChange={set("amount")} required />
        </Field>
        <Field label="Description" error={errors.description} className="sm:col-span-2">
          <Input value={v.description} onChange={set("description")} placeholder="e.g. Diesel for generator" />
        </Field>
        <Field label="Date" error={errors.date}>
          <Input type="date" value={v.date} onChange={set("date")} />
        </Field>
        <Field label="Paid via">
          <Select value={v.paymentMethod} onChange={set("paymentMethod")}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reference (optional)" className="sm:col-span-2">
          <Input value={v.reference} onChange={set("reference")} placeholder="Receipt or transfer reference" />
        </Field>
      </form>
    </Modal>
  );
}

export function AddExpenseButton({ currency, disabled }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)} disabled={disabled}>
        Record expense
      </Button>
      {open ? <ExpenseModal onClose={() => setOpen(false)} currency={currency} /> : null}
    </>
  );
}

export function ExpenseRowActions({ expense, currency, canWrite }) {
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();
  const { run } = useAction();
  const remove = async () => {
    if (!(await confirm({ title: "Delete expense?", message: "This expense will be removed from your reports.", confirmLabel: "Delete", tone: "danger" }))) return;
    await run(() => apiFetch(`/api/expenses/${expense._id}`, { method: "DELETE" }), { success: "Expense deleted", refresh: true });
  };
  if (!canWrite) return null;
  return (
    <div className="flex justify-end gap-1">
      <button type="button" onClick={() => setOpen(true)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Edit expense">
        <Pencil className="h-4 w-4" />
      </button>
      <button type="button" onClick={remove} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Delete expense">
        <Trash2 className="h-4 w-4" />
      </button>
      {open ? <ExpenseModal expense={expense} onClose={() => setOpen(false)} currency={currency} /> : null}
    </div>
  );
}
