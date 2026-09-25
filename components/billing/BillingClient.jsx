"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CreditCard, LoaderCircle, CircleCheck, CircleX, RotateCcw } from "lucide-react";
import Button from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { apiFetch, useAction } from "@/hooks/useApi";
import { formatMoney } from "@/lib/money";
import { cn } from "@/utils/cn";

const INTERVAL = { monthly: "month", quarterly: "quarter", biannually: "6 months", annually: "year" };

export function PlanCards({ plans, currentPlanId, currentPrice, isPaidActive, canManage, paystackConfigured, periodEnd }) {
  const confirm = useConfirm();
  const router = useRouter();
  const { run } = useAction();
  const [busy, setBusy] = useState(null);

  const choose = async (plan) => {
    let action = "subscribe";
    if (isPaidActive) action = plan.price > currentPrice ? "upgrade" : "downgrade";
    const copy = {
      subscribe: { title: `Subscribe to ${plan.name}?`, message: `You'll be taken to Paystack to pay ${formatMoney(plan.price, plan.currency)} per ${INTERVAL[plan.interval]}. Your subscription renews automatically until you cancel.`, confirmLabel: "Continue to payment" },
      upgrade: { title: `Upgrade to ${plan.name}?`, message: `You'll pay ${formatMoney(plan.price, plan.currency)} now and your new billing period starts today. Your current plan's recurring charge will be stopped.`, confirmLabel: "Upgrade now" },
      downgrade: {
        title: `Downgrade to ${plan.name}?`,
        message: `You'll keep your current plan until ${periodEnd || "the end of this billing period"}, then move to ${plan.name} at ${formatMoney(plan.price, plan.currency)}/${INTERVAL[plan.interval]}. Make sure your usage fits the new limits.`,
        confirmLabel: "Schedule downgrade",
        tone: "danger",
      },
    }[action];
    if (!(await confirm(copy))) return;
    setBusy(plan._id);
    const res = await run(() => apiFetch("/api/subscriptions/change", { method: "POST", body: { planId: plan._id } }));
    setBusy(null);
    if (!res) return;
    if (res.authorizationUrl) {
      window.location.href = res.authorizationUrl;
      return;
    }
    router.refresh();
  };

  return (
    <div className={cn("grid gap-5", plans.length >= 3 ? "lg:grid-cols-3" : "md:grid-cols-2")}>
      {plans.map((plan) => {
        const current = String(plan._id) === String(currentPlanId) && isPaidActive;
        const label = current ? "Current plan" : !isPaidActive ? "Subscribe" : plan.price > currentPrice ? "Upgrade" : "Downgrade";
        return (
          <div key={plan._id} className={cn("flex flex-col rounded-2xl border bg-white p-6 shadow-card", current ? "border-emerald-400 ring-2 ring-emerald-400/20" : plan.highlight ? "border-brand-400" : "border-slate-200")}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">{plan.name}</h3>
              {current ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Current</span> : plan.highlight ? <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">Popular</span> : null}
            </div>
            <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
            <p className="mt-4">
              <span className="text-3xl font-bold text-slate-900">{formatMoney(plan.price, plan.currency).replace(/\.00$/, "")}</span>
              <span className="text-sm text-slate-500">/{INTERVAL[plan.interval]}</span>
            </p>
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {plan.featureList.map((f) => (
                <li key={f} className="flex gap-2 text-slate-600">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {f}
                </li>
              ))}
            </ul>
            {canManage ? (
              <Button className="mt-6 w-full" variant={current ? "outline" : label === "Downgrade" ? "outline" : "primary"} disabled={current || !paystackConfigured} loading={busy === plan._id} onClick={() => choose(plan)}>
                {label}
              </Button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function SubscriptionControls({ status, canManage, hasCard, hasPending, accessUntil }) {
  const confirm = useConfirm();
  const { run, loading } = useAction();
  if (!canManage) return null;

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
      {status === "cancelled" ? (
        <Button size="sm" onClick={resume} loading={loading}>
          Resume subscription
        </Button>
      ) : null}
      {["active", "past_due"].includes(status) ? (
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
