"use client";

import { useState } from "react";
import { Printer, Ban } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Field, Textarea } from "@/components/ui/Field";
import { apiFetch, useAction } from "@/hooks/useApi";

export function PrintButton({ label = "Print receipt" }) {
  return (
    <Button variant="outline" icon={Printer} onClick={() => window.print()}>
      {label}
    </Button>
  );
}

export function CancelSaleButton({ saleId, invoiceNumber, disabled }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { run, loading } = useAction();
  const submit = async () => {
    const res = await run(() => apiFetch(`/api/sales/${saleId}/cancel`, { method: "POST", body: { reason } }), { success: "Sale cancelled", successMessage: "Stock and customer balance were reversed.", refresh: true });
    if (res) setOpen(false);
  };
  return (
    <>
      <Button variant="danger-outline" icon={Ban} onClick={() => setOpen(true)} disabled={disabled}>
        Cancel sale
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title={`Cancel ${invoiceNumber}?`}
        description="Items are returned to stock and any customer balance from this sale is reversed. This cannot be undone."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Keep sale
            </Button>
            <Button variant="danger" onClick={submit} loading={loading}>
              Cancel sale
            </Button>
          </>
        }
      >
        <Field label="Reason" hint="Recorded in the audit log">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Customer changed mind, wrong item scanned" />
        </Field>
      </Modal>
    </>
  );
}
