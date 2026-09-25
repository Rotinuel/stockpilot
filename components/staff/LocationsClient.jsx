"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Field, Input, Select, Checkbox } from "@/components/ui/Field";
import { useConfirm } from "@/components/ui/Confirm";
import { apiFetch, useAction } from "@/hooks/useApi";

function LocationModal({ location, staff, onClose }) {
  const isEdit = Boolean(location?._id);
  const [v, setV] = useState({ name: location?.name || "", address: location?.address || "", phone: location?.phone || "", managerId: location?.managerId || "", isActive: location?.isActive ?? true });
  const { run, loading, errors } = useAction();
  const submit = async (e) => {
    e.preventDefault();
    const res = await run(() => apiFetch(isEdit ? `/api/locations/${location._id}` : "/api/locations", { method: isEdit ? "PATCH" : "POST", body: { ...v, managerId: v.managerId || "none" } }), { success: "Location saved", refresh: true });
    if (res) onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "Edit location" : "Add location"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="loc-form" loading={loading}>
            Save
          </Button>
        </>
      }
    >
      <form id="loc-form" onSubmit={submit} className="space-y-4">
        <Field label="Name" error={errors.name} required>
          <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. Ikeja branch" required />
        </Field>
        <Field label="Address" error={errors.address}>
          <Input value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <Input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
        </Field>
        <Field label="Manager">
          <Select value={v.managerId} onChange={(e) => setV({ ...v, managerId: e.target.value })}>
            <option value="">None</option>
            {staff.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        {isEdit && !location.isDefault ? <Checkbox checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} label="Active" description="Inactive locations can't be used for sales or stock." /> : null}
      </form>
    </Modal>
  );
}

export function AddLocationButton({ staff, disabled, locked }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)} disabled={disabled || locked} title={locked ? "Multi-location is available on the Professional plan" : undefined}>
        Add location
      </Button>
      {open ? <LocationModal staff={staff} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function LocationRowActions({ location, staff, canWrite }) {
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();
  const { run } = useAction();
  const remove = async () => {
    if (!(await confirm({ title: `Delete ${location.name}?`, message: "Only locations with no stock can be deleted. Consider deactivating instead.", confirmLabel: "Delete", tone: "danger" }))) return;
    await run(() => apiFetch(`/api/locations/${location._id}`, { method: "DELETE" }), { success: "Location deleted", refresh: true });
  };
  if (!canWrite) return null;
  return (
    <div className="flex justify-end gap-1">
      <button type="button" onClick={() => setOpen(true)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Edit">
        <Pencil className="h-4 w-4" />
      </button>
      {!location.isDefault ? (
        <button type="button" onClick={remove} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Delete">
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
      {open ? <LocationModal location={location} staff={staff} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
