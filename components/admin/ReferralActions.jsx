"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Field, Input } from "@/components/ui/Field";
import { apiFetch, useAction } from "@/hooks/useApi";
import { formatMoney } from "@/lib/money";

/** Super admin: mark a referral commission paid (with a transfer note) or void a referral. */
export default function ReferralActions({ referral }) {
  const [modal, setModal] = useState(null);
  const [note, setNote] = useState("");
  const { run, loading } = useAction();
  const act = async (action) => {
    const res = await run(() => apiFetch(`/api/admin/referrals/${referral._id}`, { method: "PATCH", body: { action, note: note || undefined } }), {
      success: action === "mark_paid" ? "Marked as paid" : action === "void" ? "Referral voided" : "Moved back to owed",
      refresh: true,
    });
    if (res) {
      setModal(null);
      setNote("");
    }
  };
  const payout = referral.payout;
  return (
    <div className="flex justify-end gap-1.5">
      {referral.commissionStatus === "owed" ? (
        <Button size="xs" onClick={() => setModal("mark_paid")}>
          Mark paid
        </Button>
      ) : null}
      {referral.commissionStatus === "paid" ? (
        <Button size="xs" variant="ghost" onClick={() => act("mark_owed")} loading={loading}>
          Undo paid
        </Button>
      ) : null}
      {referral.status !== "void" && referral.commissionStatus !== "paid" ? (
        <Button size="xs" variant="ghost" onClick={() => setModal("void")}>
          Void
        </Button>
      ) : null}
      {modal ? (
        <Modal
          open
          onClose={() => setModal(null)}
          title={modal === "mark_paid" ? "Mark commission as paid" : "Void this referral?"}
          description={
            modal === "mark_paid"
              ? `Confirm you've transferred ${formatMoney(referral.commissionAmount, referral.currency)} to ${referral.referrerName}.`
              : "Use this for fraud or self-referrals. Any unpaid commission is cancelled; free days already given are not taken back."
          }
          footer={
            <>
              <Button variant="outline" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button variant={modal === "void" ? "danger" : "primary"} loading={loading} onClick={() => act(modal)}>
                {modal === "mark_paid" ? "Mark paid" : "Void referral"}
              </Button>
            </>
          }
        >
          {modal === "mark_paid" ? (
            <div className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {payout?.accountNumber ? (
                <>
                  <p className="font-medium">{payout.accountName}</p>
                  <p>
                    {payout.bankName} · <span className="font-mono">{payout.accountNumber}</span>
                  </p>
                </>
              ) : (
                <p className="text-amber-700">This business hasn&apos;t added bank details yet (Refer &amp; earn page).</p>
              )}
            </div>
          ) : null}
          <Field label={modal === "mark_paid" ? "Transfer reference / note (optional)" : "Reason (optional)"}>
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}
