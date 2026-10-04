"use client";

import { useState } from "react";
import { Copy, Check, Share2, Save } from "lucide-react";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, useAction } from "@/hooks/useApi";

/** Referral link with copy / WhatsApp / native share buttons. */
export function ReferralLinkBox({ link, code, businessName, rewardText }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const message = `I use StockPilot to manage stock and sales for ${businessName}. Start your free trial with my link: ${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const el = document.getElementById("referral-link");
      el?.select();
      document.execCommand?.("copy");
    }
    setCopied(true);
    toast.success("Link copied", "Paste it in a chat, email or social post.");
    setTimeout(() => setCopied(false), 2500);
  };
  const share = async () => {
    try {
      await navigator.share({ title: "StockPilot", text: message, url: link });
    } catch {}
  };
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input id="referral-link" value={link} readOnly onFocus={(e) => e.target.select()} className="font-mono text-sm" aria-label="Your referral link" />
        <Button icon={copied ? Check : Copy} onClick={copy} className="sm:w-36">
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
          Share on WhatsApp
        </Button>
        {canShare ? (
          <Button variant="outline" size="sm" icon={Share2} onClick={share}>
            Share…
          </Button>
        ) : null}
        <span className="text-xs text-slate-500">
          Your code: <span className="font-mono font-semibold text-slate-700">{code}</span>
        </span>
      </div>
      {rewardText ? <p className="text-xs text-slate-500">You get {rewardText} for every business that subscribes.</p> : null}
    </div>
  );
}

/** Bank account for commission payouts. */
export function PayoutForm({ payout, canEdit }) {
  const [v, setV] = useState({ bankName: payout?.bankName || "", accountNumber: payout?.accountNumber || "", accountName: payout?.accountName || "" });
  const { run, loading, errors } = useAction();
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    run(() => apiFetch("/api/referrals/payout", { method: "PATCH", body: v }), { success: "Payout details saved", refresh: true });
  };
  if (!canEdit) {
    return payout?.accountNumber ? (
      <p className="text-sm text-slate-600">
        {payout.accountName} · {payout.bankName} · ••••{payout.accountNumber.slice(-4)}
      </p>
    ) : (
      <p className="text-sm text-slate-500">The business owner hasn&apos;t added payout details yet.</p>
    );
  }
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3" noValidate>
      <Field label="Bank" htmlFor="bankName" error={errors.bankName} required>
        <Input id="bankName" value={v.bankName} onChange={set("bankName")} placeholder="e.g. GTBank" />
      </Field>
      <Field label="Account number" htmlFor="accountNumber" error={errors.accountNumber} required>
        <Input id="accountNumber" value={v.accountNumber} onChange={set("accountNumber")} inputMode="numeric" maxLength={20} placeholder="0123456789" />
      </Field>
      <Field label="Account name" htmlFor="accountName" error={errors.accountName} required>
        <Input id="accountName" value={v.accountName} onChange={set("accountName")} />
      </Field>
      <div className="sm:col-span-3">
        <Button type="submit" icon={Save} loading={loading}>
          Save payout details
        </Button>
      </div>
    </form>
  );
}
