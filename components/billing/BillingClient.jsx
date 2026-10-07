"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CreditCard, LoaderCircle, CircleCheck, CircleX, RotateCcw, Repeat, Landmark } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, useAction } from "@/hooks/useApi";
import { formatMoney } from "@/lib/money";
import { planPrice, yearlySaving, isSoldIn, CYCLE_LABEL } from "@/lib/pricing";
import { cn } from "@/utils/cn";

const money = (v, c) => formatMoney(v, c).replace(/\.00$/, "");

/**
 * Lets the business choose how to pay before going to Paystack:
 *  • Pay once — one period; Paystack shows every channel enabled on the account
 *    (bank transfer, USSD, card, bank…). We remind them before it ends.
 *  • Automatic renewal — a Paystack subscription; Paystack only offers card and
 *    direct debit for recurring payments.
 */
function CheckoutModal({ plan, action, onClose, currency = "NGN", cycle = "monthly" }) {
  const router = useRouter();
  const { run, loading } = useAction();
  const [autoRenew, setAutoRenew] = useState(false);
  const unit = CYCLE_LABEL[cycle];
  const price = `${formatMoney(planPrice(plan, currency, cycle), currency)} per ${unit}`;
  const title =
    { subscribe: `Subscribe to ${plan.name}`, upgrade: `Upgrade to ${plan.name}`, renew: `Renew ${plan.name}`, switch: `Switch to ${cycle === "annually" ? "yearly" : "monthly"} billing` }[action] || plan.name;
  const go = async () => {
    const res = await run(() => apiFetch("/api/subscriptions/change", { method: "POST", body: { planId: plan._id, autoRenew, cycle } }));
    if (!res) return;
    if (res.authorizationUrl) {
      window.location.href = res.authorizationUrl;
      return;
    }
    onClose();
    router.refresh();
  };
  const Option = ({ value, icon: Icon, label, hint }) => (
    <label className={cn("flex cursor-pointer gap-3 rounded-xl border p-4 transition", autoRenew === value ? "border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/15" : "border-slate-200 hover:border-slate-300")}>
      <input type="radio" name="payment-mode" className="mt-1 accent-brand-600" checked={autoRenew === value} onChange={() => setAutoRenew(value)} />
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Icon className="h-4 w-4 text-brand-600" /> {label}
        </span>
        <span className="mt-0.5 block text-sm text-slate-600">{hint}</span>
      </span>
    </label>
  );
  const onceHint = currency === "NGN" ? `Bank transfer, USSD, card or bank app. Covers one ${unit} — we'll remind you before it ends.` : `Card payment. Covers one ${unit} — we'll remind you before it ends.`;
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={`${plan.name} · ${price}.${action === "upgrade" ? " Your new billing period starts today." : action === "renew" || action === "switch" ? " The new period starts when your current one ends." : ""}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={go} loading={loading}>
            Continue to payment
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Option value={false} icon={Landmark} label="Pay once" hint={onceHint} />
        <Option value={true} icon={Repeat} label="Automatic renewal" hint={`${currency === "NGN" ? "Card or direct debit" : "Card"} only. Charged every ${unit} until you cancel.`} />
        <p className="text-xs text-slate-500">You'll complete payment securely on Paystack{currency === "USD" ? " in US dollars" : ""}.</p>
      </div>
    </Modal>
  );
}

function CycleToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1" role="radiogroup" aria-label="Billing period">
      {[
        ["monthly", "Monthly", null],
        ["annually", "Yearly", "2 months free"],
      ].map(([v, label, badge]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn("rounded-lg px-4 py-1.5 text-sm font-semibold transition", value === v ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900")}
        >
          {label}
          {badge ? <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold", value === v ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700")}>{badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function PlanCards({ plans, currentPlanId, currentPrice, isPaidActive, canManage, paystackConfigured, periodEnd, billingMode = "auto", currency = "NGN", currentCycle = "monthly" }) {
  const confirm = useConfirm();
  const router = useRouter();
  const toast = useToast();
  const { run } = useAction();
  const [busy, setBusy] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [cycle, setCycle] = useState(currentCycle === "annually" ? "annually" : "monthly");
  const sold = plans.filter((p) => isSoldIn(p, currency, cycle));

  const choose = async (plan) => {
    if (!paystackConfigured) {
      toast.error("Payments aren't set up yet", "Online payment (Paystack) hasn't been configured, so this plan can't be purchased yet. See the notice at the top of this page.");
      return;
    }
    const samePlan = String(plan._id) === String(currentPlanId) && isPaidActive;
    if (samePlan && cycle !== currentCycle) return setCheckout({ plan, action: "switch" });
    if (samePlan) return setCheckout({ plan, action: "renew" });
    if (!isPaidActive) return setCheckout({ plan, action: "subscribe" });
    if (plan.price > currentPrice) return setCheckout({ plan, action: "upgrade" });
    const ok = await confirm({
      title: `Downgrade to ${plan.name}?`,
      message: `You'll keep your current plan until ${periodEnd || "the end of this billing period"}, then move to ${plan.name} at ${formatMoney(planPrice(plan, currency, currentCycle), currency)}/${CYCLE_LABEL[currentCycle]}. Make sure your usage fits the new limits.`,
      confirmLabel: "Schedule downgrade",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(plan._id);
    const res = await run(() => apiFetch("/api/subscriptions/change", { method: "POST", body: { planId: plan._id, cycle: currentCycle } }));
    setBusy(null);
    if (!res) return;
    if (res.authorizationUrl) {
      window.location.href = res.authorizationUrl;
      return;
    }
    router.refresh();
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <CycleToggle value={cycle} onChange={setCycle} />
        <p className="text-sm text-slate-500">
          Prices in {currency === "NGN" ? "Naira (₦)" : "US dollars ($)"}
          {currency === "USD" ? " — for businesses outside Nigeria" : ""}.
        </p>
      </div>
      {checkout ? <CheckoutModal plan={checkout.plan} action={checkout.action} currency={currency} cycle={cycle} onClose={() => setCheckout(null)} /> : null}
      {!sold.length ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No plans are available in {currency} yet. Please contact support.</p> : null}
      <div className={cn("grid gap-5", sold.length >= 3 ? "lg:grid-cols-3" : "md:grid-cols-2")}>
        {sold.map((plan) => {
          const samePlan = String(plan._id) === String(currentPlanId) && isPaidActive;
          const current = samePlan && cycle === currentCycle;
          const canRenew = current && billingMode === "manual";
          const price = planPrice(plan, currency, cycle);
          const saving = yearlySaving(plan, currency);
          const label = samePlan && !current ? `Switch to ${cycle === "annually" ? "yearly" : "monthly"}` : canRenew ? "Pay for next period" : current ? "Current plan" : !isPaidActive ? "Subscribe" : plan.price > currentPrice ? "Upgrade" : "Downgrade";
          return (
            <div key={plan._id} className={cn("flex flex-col rounded-2xl border bg-white p-6 shadow-card", current ? "border-emerald-400 ring-2 ring-emerald-400/20" : plan.highlight ? "border-brand-400" : "border-slate-200")}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">{plan.name}</h3>
                {current ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Current</span> : plan.highlight ? <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">Popular</span> : null}
              </div>
              <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
              <p className="mt-4">
                <span className="text-3xl font-bold text-slate-900">{money(price, currency)}</span>
                <span className="text-sm text-slate-500">/{CYCLE_LABEL[cycle]}</span>
              </p>
              <p className="mt-0.5 min-h-5 text-xs text-emerald-700">{cycle === "annually" && saving > 0 ? `≈ ${money(price / 12, currency)}/month · you save ${money(saving, currency)}` : ""}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {(plan.featureList || []).map((f) => (
                  <li key={f} className="flex gap-2 text-slate-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {f}
                  </li>
                ))}
              </ul>
              {canManage ? (
                <Button
                  className="mt-6 w-full"
                  variant={current && !canRenew ? "outline" : label === "Downgrade" ? "outline" : "primary"}
                  disabled={(current && !canRenew) || (busy && busy !== plan._id)}
                  loading={busy === plan._id}
                  onClick={() => choose(plan)}
                >
                  {label}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SubscriptionControls({ status, canManage, hasCard, hasPending, accessUntil, billingMode = "auto", currentPlan = null, currency = "NGN", cycle = "monthly" }) {
  const confirm = useConfirm();
  const { run, loading } = useAction();
  const [renewing, setRenewing] = useState(false);
  if (!canManage) return null;
  const manual = billingMode === "manual";

  const cancel = async () => {
    const ok = await confirm({
      title: "Cancel your subscription?",
      message: `Your plan will not renew. You keep full access until ${accessUntil || "the end of the current period"}; after that your account becomes read-only. Your data is never deleted.`,
      confirmLabel: "Cancel subscription",
      cancelLabel: "Keep subscription",
      tone: "danger",
    });
    if (ok) await run(() => apiFetch("/api/subscriptions/cancel", { method: "POST" }), { success: "Subscription cancelled", refresh: true });
  };
  const resume = () => run(() => apiFetch("/api/subscriptions/resume", { method: "POST" }), { success: "Subscription resumed", refresh: true });
  const manageCard = async () => {
    const res = await run(() => apiFetch("/api/subscriptions/manage-link"));
    if (res?.link) window.open(res.link, "_blank", "noopener");
  };
  const undoPending = async () => {
    if (await confirm({ title: "Keep your current plan?", message: "The scheduled plan change will be removed.", confirmLabel: "Remove scheduled change" }))
      await run(() => apiFetch("/api/subscriptions/pending", { method: "DELETE" }), { success: "Scheduled change removed", refresh: true });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {renewing && currentPlan ? <CheckoutModal plan={currentPlan} action="renew" currency={currency} cycle={cycle} onClose={() => setRenewing(false)} /> : null}
      {manual && currentPlan && !currentPlan.isTrial && ["active", "past_due", "expired"].includes(status) ? (
        <Button size="sm" icon={Repeat} onClick={() => setRenewing(true)}>
          Renew now
        </Button>
      ) : null}
      {hasCard && ["active", "past_due"].includes(status) ? (
        <Button variant="outline" size="sm" icon={CreditCard} onClick={manageCard} loading={loading}>
          Update card
        </Button>
      ) : null}
      {hasPending ? (
        <Button variant="outline" size="sm" icon={RotateCcw} onClick={undoPending}>
          Undo scheduled change
        </Button>
      ) : null}
      {status === "cancelled" && !manual ? (
        <Button size="sm" onClick={resume} loading={loading}>
          Resume subscription
        </Button>
      ) : null}
      {["active", "past_due"].includes(status) && !manual ? (
        <Button variant="danger-outline" size="sm" onClick={cancel} loading={loading}>
          Cancel subscription
        </Button>
      ) : null}
    </div>
  );
}

export function PaymentCallback({ reference }) {
  const [state, setState] = useState({ status: reference ? "verifying" : "error", message: reference ? "" : "Missing payment reference." });
  const started = useRef(false);
  const router = useRouter();
  useEffect(() => {
    if (!reference || started.current) return;
    started.current = true;
    let attempts = 0;
    const verify = async () => {
      attempts++;
      try {
        const res = await apiFetch("/api/subscriptions/verify", { method: "POST", body: { reference } });
        if (res.status === "success") {
          setState({ status: "success", message: "Payment confirmed. Your subscription is active." });
          setTimeout(() => {
            router.replace("/billing");
            router.refresh();
          }, 2500);
        } else if (["failed", "abandoned", "reversed"].includes(res.status)) {
          setState({ status: "error", message: `Payment ${res.status}. You have not been charged for a new plan.` });
        } else if (attempts < 6) {
          setTimeout(verify, 3000);
        } else {
          setState({ status: "pending", message: "Your payment is still processing. We'll activate your plan automatically once Paystack confirms it." });
        }
      } catch (err) {
        setState({ status: "error", message: err.message });
      }
    };
    verify();
  }, [reference, router]);

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
      {state.status === "verifying" ? <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-brand-600" /> : state.status === "success" ? <CircleCheck className="mx-auto h-10 w-10 text-emerald-500" /> : <CircleX className={cn("mx-auto h-10 w-10", state.status === "pending" ? "text-amber-500" : "text-rose-500")} />}
      <h1 className="mt-4 text-lg font-semibold text-slate-900">{state.status === "verifying" ? "Confirming your payment…" : state.status === "success" ? "You're all set!" : state.status === "pending" ? "Payment processing" : "Payment not completed"}</h1>
      <p className="mt-2 text-sm text-slate-500">{state.message || "Please wait while we confirm your payment with Paystack. Don't close this page."}</p>
      {state.status !== "verifying" ? (
        <Link href="/billing" className="mt-6 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700">
          Back to billing →
        </Link>
      ) : null}
    </div>
  );
}
