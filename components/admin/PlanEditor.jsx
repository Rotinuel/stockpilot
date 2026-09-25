"use client";

import { useState } from "react";
import { Plus, Pencil, RefreshCw, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/Field";
import { useConfirm } from "@/components/ui/Confirm";
import { apiFetch, useAction } from "@/hooks/useApi";
import { PLAN_FEATURE_LABELS, PLAN_LIMIT_LABELS } from "@/lib/constants";

const EMPTY = {
  code: "",
  name: "",
  description: "",
  price: "0",
  currency: "NGN",
  interval: "monthly",
  isTrial: false,
  durationDays: "30",
  isActive: true,
  isPublic: true,
  highlight: false,
  sortOrder: "10",
  featureList: "",
  limits: { products: "-1", staffUsers: "-1", locations: "1", monthlyTransactions: "-1" },
  features: Object.fromEntries(Object.keys(PLAN_FEATURE_LABELS).map((k) => [k, false])),
};

function toForm(plan) {
  if (!plan) return EMPTY;
  return {
    ...EMPTY,
    ...plan,
    price: String(plan.price),
    durationDays: String(plan.durationDays ?? 30),
    sortOrder: String(plan.sortOrder ?? 0),
    featureList: (plan.featureList || []).join("\n"),
    limits: Object.fromEntries(Object.keys(PLAN_LIMIT_LABELS).map((k) => [k, String(plan.limits?.[k] ?? -1)])),
    features: { ...EMPTY.features, ...(plan.features || {}) },
  };
}

function PlanModal({ plan, onClose }) {
  const isEdit = Boolean(plan?._id);
  const [v, setV] = useState(toForm(plan));
  const { run, loading, errors } = useAction();
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    const body = {
      ...v,
      price: Number(v.price) || 0,
      durationDays: Number(v.durationDays) || 30,
      sortOrder: Number(v.sortOrder) || 0,
      featureList: v.featureList.split("\n").map((s) => s.trim()).filter(Boolean),
      limits: Object.fromEntries(Object.entries(v.limits).map(([k, x]) => [k, Number(x)])),
      features: v.features,
    };
    delete body._id;
    delete body.tenantCount;
    delete body.paystackPlanCode;
    delete body.createdAt;
    delete body.updatedAt;
    delete body.id;
    if (isEdit) delete body.code;
    const res = await run(() => apiFetch(isEdit ? `/api/admin/plans/${plan._id}` : "/api/admin/plans", { method: isEdit ? "PATCH" : "POST", body }), { success: isEdit ? "Plan updated" : "Plan created", refresh: true });
    if (res) {
      if (res.paystackSync?.error) alertLater(res.paystackSync.error);
      onClose();
    }
  };
  return (
    <Modal
      open
      size="xl"
      onClose={onClose}
      title={isEdit ? `Edit ${plan.name}` : "New plan"}
      description="Price changes are pushed to Paystack for new subscribers; existing subscribers keep their current price until they change plan."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="plan-form" loading={loading}>
            Save plan
          </Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={submit} className="grid gap-4 md:grid-cols-4" noValidate>
        <Field label="Code" hint="Permanent identifier" error={errors.code}>
          <Input value={v.code} onChange={set("code")} disabled={isEdit} placeholder="business" />
        </Field>
        <Field label="Name" error={errors.name} className="md:col-span-3">
          <Input value={v.name} onChange={set("name")} />
        </Field>
        <Field label="Description" className="md:col-span-4">
          <Input value={v.description} onChange={set("description")} />
        </Field>
        <Field label="Price" error={errors.price}>
          <Input type="number" min="0" step="0.01" value={v.price} onChange={set("price")} />
        </Field>
        <Field label="Currency">
          <Input value={v.currency} onChange={set("currency")} maxLength={3} />
        </Field>
        <Field label="Billing interval">
          <Select value={v.interval} onChange={set("interval")}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="biannually">Every 6 months</option>
            <option value="annually">Annually</option>
          </Select>
        </Field>
        <Field label="Sort order">
          <Input type="number" value={v.sortOrder} onChange={set("sortOrder")} />
        </Field>
        <div className="md:col-span-4">
          <p className="mb-2 text-sm font-semibold text-slate-800">Limits (−1 = unlimited)</p>
          <div className="grid gap-3 sm:grid-cols-4">
            {Object.entries(PLAN_LIMIT_LABELS).map(([k, label]) => (
              <Field key={k} label={label}>
                <Input type="number" min="-1" value={v.limits[k]} onChange={(e) => setV((s) => ({ ...s, limits: { ...s.limits, [k]: e.target.value } }))} />
              </Field>
            ))}
          </div>
        </div>
        <div className="md:col-span-4">
          <p className="mb-2 text-sm font-semibold text-slate-800">Features</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(PLAN_FEATURE_LABELS).map(([k, label]) => (
              <Checkbox key={k} label={label} checked={Boolean(v.features[k])} onChange={(e) => setV((s) => ({ ...s, features: { ...s.features, [k]: e.target.checked } }))} />
            ))}
          </div>
        </div>
        <Field label="Marketing bullet points (one per line)" className="md:col-span-4">
          <Textarea rows={5} value={v.featureList} onChange={set("featureList")} />
        </Field>
        <div className="flex flex-wrap gap-6 md:col-span-4">
          <Checkbox label="Active" checked={v.isActive} onChange={set("isActive")} />
          <Checkbox label="Shown on pricing page" checked={v.isPublic} onChange={set("isPublic")} />
          <Checkbox label="Highlight as most popular" checked={v.highlight} onChange={set("highlight")} />
          {!isEdit ? <Checkbox label="Trial plan" checked={v.isTrial} onChange={set("isTrial")} /> : null}
        </div>
      </form>
    </Modal>
  );
}

function alertLater(msg) {
  setTimeout(() => window.alert(`Saved, but Paystack sync failed: ${msg}`), 50);
}

export function NewPlanButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)}>
        New plan
      </Button>
      {open ? <PlanModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function PlanRowActions({ plan, paystackConfigured }) {
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();
  const { run, loading } = useAction();
  const sync = () => run(() => apiFetch(`/api/admin/plans/${plan._id}/sync`, { method: "POST" }), { success: "Synced with Paystack", refresh: true });
  const remove = async () => {
    if (!(await confirm({ title: `Remove ${plan.name}?`, message: "Plans in use are deactivated and hidden instead of deleted.", confirmLabel: "Remove", tone: "danger" }))) return;
    await run(() => apiFetch(`/api/admin/plans/${plan._id}`, { method: "DELETE" }), { success: "Plan updated", refresh: true });
  };
  return (
    <div className="flex justify-end gap-1">
      <Button size="xs" variant="outline" icon={Pencil} onClick={() => setOpen(true)}>
        Edit
      </Button>
      {!plan.isTrial && paystackConfigured ? (
        <Button size="xs" variant="outline" icon={RefreshCw} onClick={sync} loading={loading}>
          {plan.paystackPlanCode ? "Re-sync" : "Create on Paystack"}
        </Button>
      ) : null}
      {!plan.isTrial ? (
        <Button size="xs" variant="ghost" icon={Trash2} onClick={remove} aria-label="Remove plan" />
      ) : null}
      {open ? <PlanModal plan={plan} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
