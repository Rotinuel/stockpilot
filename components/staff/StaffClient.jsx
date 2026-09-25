"use client";

import { useState } from "react";
import { UserPlus, Copy, Check, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Field";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, useAction } from "@/hooks/useApi";
import { ROLE_LABELS } from "@/lib/constants";

const ROLE_HELP = {
  admin: "Almost everything, except subscription ownership.",
  manager: "Products, inventory, sales, customers, suppliers and reports.",
  cashier: "POS, view products, create sales and view customers.",
  inventory_staff: "View products, add stock, adjust inventory, inventory reports.",
};

export function InviteButton({ roles, locations, disabled }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ email: "", name: "", role: roles.includes("cashier") ? "cashier" : roles[0], locationId: "" });
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const { run, loading, errors } = useAction();

  const close = () => {
    setOpen(false);
    setResult(null);
    setV({ email: "", name: "", role: roles.includes("cashier") ? "cashier" : roles[0], locationId: "" });
  };
  const submit = async (e) => {
    e.preventDefault();
    const res = await run(() => apiFetch("/api/staff", { method: "POST", body: { ...v, locationId: v.locationId || undefined } }), { success: "Invitation created", refresh: true });
    if (res) setResult(res);
  };
  const copy = async () => {
    await navigator.clipboard.writeText(result.inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <>
      <Button icon={UserPlus} onClick={() => setOpen(true)} disabled={disabled}>
        Invite staff
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={result ? "Invitation ready" : "Invite a team member"}
        footer={
          result ? (
            <Button onClick={close}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" form="invite-form" loading={loading}>
                Send invitation
              </Button>
            </>
          )
        }
      >
        {result ? (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">
              {result.emailSent ? `We emailed an invitation to ${result.invitation.email}.` : "Email isn't configured yet, so share this link with them directly (e.g. on WhatsApp)."} The link expires in 7 days.
            </p>
            <div className="flex gap-2">
              <Input readOnly value={result.inviteLink} onFocus={(e) => e.target.select()} />
              <Button variant="outline" icon={copied ? Check : Copy} onClick={copy} className="h-10">
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        ) : (
          <form id="invite-form" onSubmit={submit} className="space-y-4" noValidate>
            <Field label="Email address" error={errors.email} required>
              <Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required />
            </Field>
            <Field label="Name (optional)" error={errors.name}>
              <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
            </Field>
            <Field label="Role" hint={ROLE_HELP[v.role]} error={errors.role}>
              <Select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
            {locations.length > 1 ? (
              <Field label="Works at">
                <Select value={v.locationId} onChange={(e) => setV({ ...v, locationId: e.target.value })}>
                  <option value="">Default location</option>
                  {locations.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </form>
        )}
      </Modal>
    </>
  );
}

export function StaffRowControls({ user, roles, editable }) {
  const confirm = useConfirm();
  const { run, loading } = useAction();
  if (!editable) return <span className="text-sm text-slate-500">{ROLE_LABELS[user.role]}</span>;
  const changeRole = async (role) => {
    if (role === user.role) return;
    const ok = await confirm({ title: `Change ${user.name}'s role?`, message: `${ROLE_LABELS[user.role]} → ${ROLE_LABELS[role]}. They'll be signed out and see the new permissions next time they sign in.`, confirmLabel: "Change role" });
    if (ok) await run(() => apiFetch(`/api/staff/${user._id}`, { method: "PATCH", body: { role } }), { success: "Role updated", refresh: true });
  };
  const toggle = async () => {
    const ok = await confirm({
      title: user.isActive ? `Deactivate ${user.name}?` : `Reactivate ${user.name}?`,
      message: user.isActive ? "They'll be signed out immediately and won't be able to sign in. Their past sales stay on record." : "They'll be able to sign in again.",
      confirmLabel: user.isActive ? "Deactivate" : "Reactivate",
      tone: user.isActive ? "danger" : "primary",
    });
    if (ok) await run(() => apiFetch(`/api/staff/${user._id}`, { method: "PATCH", body: { isActive: !user.isActive } }), { success: user.isActive ? "User deactivated" : "User reactivated", refresh: true });
  };
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select value={user.role} onChange={(e) => changeRole(e.target.value)} className="field-input h-8 w-auto py-0 text-xs" disabled={loading || !user.isActive} aria-label="Role">
        {[...new Set([user.role, ...roles])].map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <Button size="sm" variant={user.isActive ? "danger-outline" : "outline"} onClick={toggle} loading={loading}>
        {user.isActive ? "Deactivate" : "Reactivate"}
      </Button>
    </div>
  );
}

export function RevokeInviteButton({ id }) {
  const toast = useToast();
  const { run, loading } = useAction();
  return (
    <Button size="sm" variant="ghost" icon={X} loading={loading} onClick={() => run(() => apiFetch(`/api/staff/invitations/${id}`, { method: "DELETE" }), { success: "Invitation revoked", refresh: true }).catch(() => toast.error("Failed"))}>
      Revoke
    </Button>
  );
}
