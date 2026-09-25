"use client";

import { useState } from "react";
import { Ban, CircleCheck, CalendarPlus, Layers } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { apiFetch, useAction } from "@/hooks/useApi";

export default function TenantActions({ tenant, plans }) {
  const [modal, setModal] = useState(null);
  const [v, setV] = useState({ reason: "", days: "7", planId: plans.find((p) => !p.isTrial)?._id || "", periodDays: "" });
  const { run, loading } = useAction();
  const act = async (action, extra = {}) => {
    const res = await run(() => apiFetch(`/api/admin/tenants/${tenant._id}`, { method: "PATCH", body: { action, ...extra } }), { success: "Updated", refresh: true });
    if (res) setModal(null);
  };
  return (
    <>
      {tenant.status === "suspended" ? (
        <Button variant="success" icon={CircleCheck} onClick={() => act("activate")} loading={loading}>
          Reactivate
        </Button>
      ) : (
        <Button variant="danger-outline" icon={Ban} onClick={() => setModal("suspend")}>
          Suspend
        </Button>
      )}
      <Button variant="outline" icon={CalendarPlus} onClick={() => setModal("trial")}>
        Extend trial
      </Button>
      <Button variant="outline" icon={Layers} onClick={() => setModal("plan")}>
        Set plan
      </Button>
      <Modal
        open={modal === "suspend"}
        onClose={() => setModal(null)}
        title={`Suspend ${tenant.businessName}?`}
        description="All users are signed out and blocked until reactivated. No data is deleted."
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={loading} onClick={() => act("suspend", { reason: v.reason })}>
              Suspend business
            </Button>
          </>
        }
      >
        <Field label="Reason (internal)">
          <Textarea rows={2} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} />
        </Field>
      </Modal>
      <Modal
        open={modal === "trial"}
        onClose={() => setModal(null)}
        title="Extend free trial"
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button loading={loading} onClick={() => act("extend_trial", { days: Number(v.days) })}>
              Extend
            </Button>
          </>
        }
      >
        <Field label="Extra days" hint="Sets the business back to trialing.">
          <Input type="number" min="1" max="90" value={v.days} onChange={(e) => setV({ ...v, days: e.target.value })} />
        </Field>
      </Modal>
      <Modal
        open={modal === "plan"}
        onClose={() => setModal(null)}
        title="Set plan manually"
        description="Use for offline payments (e.g. bank transfer) or complimentary accounts. No Paystack charge is made and it will not auto-renew."
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button loading={loading} onClick={() => act("set_plan", { planId: v.planId, periodDays: v.periodDays ? Number(v.periodDays) : undefined })}>
              Apply plan
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Plan">
            <Select value={v.planId} onChange={(e) => setV({ ...v, planId: e.target.value })}>
              {plans.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Period (days)" hint="Leave empty for one billing interval">
            <Input type="number" min="1" max="400" value={v.periodDays} onChange={(e) => setV({ ...v, periodDays: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
