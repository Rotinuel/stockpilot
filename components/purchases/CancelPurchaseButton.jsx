"use client";

import { Ban } from "lucide-react";
import Button from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { apiFetch, useAction } from "@/hooks/useApi";

export default function CancelPurchaseButton({ id, reference, disabled }) {
  const confirm = useConfirm();
  const { run, loading } = useAction();
  const cancel = async () => {
    const ok = await confirm({
      title: `Cancel ${reference}?`,
      message: "The received quantities will be removed from stock and the supplier balance reversed. This is only possible if the stock is still on hand.",
      confirmLabel: "Cancel purchase",
      tone: "danger",
    });
    if (ok) await run(() => apiFetch(`/api/purchases/${id}/cancel`, { method: "POST" }), { success: "Purchase cancelled", refresh: true });
  };
  return (
    <Button variant="danger-outline" icon={Ban} onClick={cancel} loading={loading} disabled={disabled}>
      Cancel purchase
    </Button>
  );
}
