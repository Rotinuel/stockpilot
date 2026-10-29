"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CreditCard, LoaderCircle, CircleCheck, CircleX, RotateCcw, Repeat, Landmark, Wallet, Infinity as InfinityIcon } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, useAction } from "@/hooks/useApi";
import { formatMoney } from "@/lib/money";
import { planPrice, yearlySaving, isSoldIn, lifetimeUpgradePrice, CYCLE_LABEL, PRICE_SUFFIX } from "@/lib/pricing";
import { cn } from "@/utils/cn";

const money = (v, c) => formatMoney(v, c).replace(/\.00$/, "");

/**
 * Lets the business choose how to pay:
 *  • Paystack, pay once — one period; every channel enabled on the account (transfer, USSD, card…).
 *  • Paystack, automatic renewal — a Paystack subscription (card / direct debit only).
 *  • OPay — one period (card, bank transfer, USSD, OPay wallet). OPay has no subscriptions,
 *    so it's always "pay once" and we remind them before it ends.
 *  • Lifetime — one payment (either provider), the plan is theirs forever. `amount` overrides
 *    the price (lifetime upgrades only pay the difference).
 */
function CheckoutModal({ plan, action, onClose, currency = "NGN", cycle = "monthly", providers = { paystack: true, opay: false }, amount }) {
  const router = useRouter();
  const { run, loading } = useAction();
  const [provider, setProvider] = useState(providers.paystack ? "paystack" : "opay");
  const [autoRenew, setAutoRenew] = useState(false);
  const unit = CYCLE_LABEL[cycle];
  const lifetime = cycle === "lifetime";
  const due = amount ?? planPrice(plan, currency, cycle);
  const price = lifetime ? `${formatMoney(due, currency)} once — yours for life` : `${formatMoney(due, currency)} per ${unit}`;
  const title = lifetime
    ? { upgrade: `Upgrade to ${plan.name} for life`, switch: `Switch ${plan.name} to lifetime access` }[action] || `Lifetime access to ${plan.name}`
    : { subscribe: `Subscribe to ${plan.name}`, upgrade: `Upgrade to ${plan.name}`, renew: `Renew ${plan.name}`, switch: `Switch to ${cycle === "annually" ? "yearly" : "monthly"} billing` }[action] || plan.name;
  const isOpay = provider === "opay";
  const go = async () => {
    const res = await run(() => apiFetch("/api/subscriptions/change", { method: "POST", body: { planId: plan._id, autoRenew: isOpay || lifetime ? false : autoRenew, cycle, provider } }));
    if (!res) return;
    if (res.authorizationUrl) {
      window.location.href = res.authorizationUrl;
      return;
    }
    onClose();
    router.refresh();
  };
  const Choice = ({ name, checked, onSelect, icon: Icon, label, hint }) => (
    <label className={cn("flex cursor-pointer gap-3 rounded-xl border p-4 transition", checked ? "border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/15" : "border-slate-200 hover:border-slate-300")}>
      <input type="radio" name={name} className="mt-1 accent-brand-600" checked={checked} onChange={onSelect} />
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Icon className="h-4 w-4 text-brand-600" /> {label}
        </span>
        <span className="mt-0.5 block text-sm text-slate-600">{hint}</span>
      </span>
    </label>
  );
  const onceHint = currency === "NGN" ? `Bank transfer, USSD, card or bank app. Covers one ${unit} — we'll remind you before it ends.` : `Card payment. Covers one ${unit} — we'll remind you before it ends.`;
  const both = providers.paystack && providers.opay;
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={`${plan.name} · ${price}.${lifetime ? (amount != null ? " You only pay the difference from your current lifetime plan." : " Starts today. No renewals, ever.") : action === "upgrade" ? " Your new billing period starts today." : action === "renew" || action === "switch" ? " The new period starts when your current one ends." : ""}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={go} loading={loading}>
            Continue to {isOpay ? "OPay" : "Paystack"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {both ? (
          <>
            <p className="text-sm font-semibold text-slate-900">Pay with</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Choice name="provider" checked={provider === "paystack"} onSelect={() => setProvider("paystack")} icon={CreditCard} label="Paystack" hint="Card, transfer, USSD — or automatic renewal." />
              <Choice name="provider" checked={isOpay} onSelect={() => setProvider("opay")} icon={Wallet} label="OPay" hint="OPay wallet, card, transfer or USSD." />
            </div>
          </>
        ) : null}
        {lifetime ? (
          <p className="rounded-xl border border-brand-200 bg-brand-50/50 p-4 text-sm text-slate-600">
            <span className="flex items-center gap-2 font-semibold text-slate-900">
              <InfinityIcon className="h-4 w-4 text-brand-600" /> One payment, lifetime access
            </span>
            <span className="mt-0.5 block">
              {isOpay ? (currency === "NGN" ? "OPay wallet, card, bank transfer or USSD." : "Card payment.") : currency === "NGN" ? "Card, bank transfer, USSD or bank app." : "Card payment."} You keep the {plan.name} plan for as long as StockPilot runs — no monthly or yearly bills.
            </span>
          </p>
        ) : isOpay ? (
          <p className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
            <span className="flex items-center gap-2 font-semibold text-slate-900">
              <Wallet className="h-4 w-4 text-brand-600" /> Pay once with OPay
            </span>
            <span className="mt-0.5 block">
              {currency === "NGN" ? "OPay wallet, card, bank transfer or USSD." : "Card payment."} Covers one {unit} — we&apos;ll remind you before it ends so you can renew.
            </span>
          </p>
        ) : (
          <>
            {both ? <p className="pt-1 text-sm font-semibold text-slate-900">How to pay</p> : null}
            <Choice name="payment-mode" checked={autoRenew === false} onSelect={() => setAutoRenew(false)} icon={Landmark} label="Pay once" hint={onceHint} />
            <Choice name="payment-mode" checked={autoRenew === true} onSelect={() => setAutoRenew(true)} icon={Repeat} label="Automatic renewal" hint={`${currency === "NGN" ? "Card or direct debit" : "Card"} only. Charged every ${unit} until you cancel.`} />
          </>
        )}
        <p className="text-xs text-slate-500">
          You&apos;ll complete payment securely on {isOpay ? "OPay" : "Paystack"}
          {currency === "USD" ? " in US dollars" : ""}.
        </p>
      </div>
    </Modal>
  );
}

function CycleToggle({ value, onChange, lifetime = true }) {
  return (
    <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-1" role="radiogroup" aria-label="Billing period">
      {[
        ["monthly", "Monthly", null],
        ["annually", "Yearly", "2 months free"],
        ...(lifetime ? [["lifetime", "Lifetime", "pay once"]] : []),
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

export function PlanCards({ plans, currentPlanId, currentPrice, isPaidActive, canManage, paymentsConfigured, providers, periodEnd, billingMode = "auto", currency = "NGN", currentCycle = "monthly" }) {
  const confirm = useConfirm();
  const router = useRouter();
  const toast = useToast();
  const { run } = useAction();
  const [busy, setBusy] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const lifetimeHolder = currentCycle === "lifetime" && isPaidActive;
  const [cycle, setCycle] = useState(["annually", "lifetime"].includes(currentCycle) ? currentCycle : "monthly");
  const sold = plans.filter((p) => isSoldIn(p, currency, cycle) || (lifetimeHolder && String(p._id) === String(currentPlanId)));
  const lifetimeOnSale = plans.some((p) => isSoldIn(p, currency, "lifetime"));
  const currentPlan = plans.find((p) => String(p._id) === String(currentPlanId));

  const choose = async (plan) => {
    if (!paymentsConfigured) {
      toast.error("Payments aren't set up yet", "Online payment (Paystack or OPay) hasn't been configured, so this plan can't be purchased yet. See the notice at the top of this page.");
      return;
    }
    const samePlan = String(plan._id) === String(currentPlanId) && isPaidActive;
    if (lifetimeHolder) return setCheckout({ plan, action: "upgrade", amount: lifetimeUpgradePrice(currentPlan, plan, currency) });
    if (cycle === "lifetime") return setCheckout({ plan, action: samePlan ? "switch" : !isPaidActive ? "subscribe" : plan.price > currentPrice ? "upgrade" : "subscribe" });
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
        {lifetimeHolder ? (
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <InfinityIcon className="h-4 w-4" /> You have lifetime access. Upgrade to a higher plan and only pay the difference.
          </p>
        ) : (
          <CycleToggle value={cycle} onChange={setCycle} lifetime={lifetimeOnSale} />
        )}
        <p className="text-sm text-slate-500">
          Prices in {currency === "NGN" ? "Naira (₦)" : "US dollars ($)"}
          {currency === "USD" ? " — for businesses outside Nigeria" : ""}.
        </p>
      </div>
      {checkout ? <CheckoutModal plan={checkout.plan} action={checkout.action} amount={checkout.amount} currency={currency} cycle={cycle} providers={providers} onClose={() => setCheckout(null)} /> : null}
      {!sold.length ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No plans are available in {currency} yet. Please contact support.</p> : null}
      <div className={cn("grid gap-5", sold.length >= 3 ? "lg:grid-cols-3" : "md:grid-cols-2")}>
        {sold.map((plan) => {
          const samePlan = String(plan._id) === String(currentPlanId) && isPaidActive;
          const current = samePlan && cycle === currentCycle;
          const canRenew = current && billingMode === "manual" && cycle !== "lifetime";
          const price = planPrice(plan, currency, cycle);
          const saving = yearlySaving(plan, currency);
          const upgradeCost = lifetimeHolder && !current && plan.price > currentPrice ? lifetimeUpgradePrice(currentPlan, plan, currency) : 0;
          const blocked = lifetimeHolder && !current && !upgradeCost; // lower plans can't be bought on top of lifetime
          const label = lifetimeHolder
            ? current
              ? "Your lifetime plan"
              : upgradeCost
                ? `Upgrade for ${money(upgradeCost, currency)}`
                : "Included in your lifetime plan"
            : cycle === "lifetime"
              ? samePlan
                ? "Switch to lifetime"
                : "Get lifetime access"
              : samePlan && !current
                ? `Switch to ${cycle === "annually" ? "yearly" : "monthly"}`
                : canRenew
                  ? "Pay for next period"
                  : current
                    ? "Current plan"
                    : !isPaidActive
                      ? "Subscribe"
                      : plan.price > currentPrice
                        ? "Upgrade"
                        : "Downgrade";
          return (
            <div key={plan._id} className={cn("flex flex-col rounded-2xl border bg-white p-6 shadow-card", current ? "border-emerald-400 ring-2 ring-emerald-400/20" : plan.highlight ? "border-brand-400" : "border-slate-200")}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">{plan.name}</h3>
                {current ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Current</span> : plan.highlight ? <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">Popular</span> : null}
              </div>
              <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
              <p className="mt-4">
                <span className="text-3xl font-bold text-slate-900">{money(price, currency)}</span>
                <span className="text-sm text-slate-500">{PRICE_SUFFIX[cycle]}</span>
              </p>
              <p className="mt-0.5 min-h-5 text-xs text-emerald-700">
                {cycle === "annually" && saving > 0 ? `≈ ${money(price / 12, currency)}/month · you save ${money(saving, currency)}` : cycle === "lifetime" ? "Pay once · no renewals, ever" : ""}
              </p>
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
                  variant={(current && !canRenew) || blocked || label === "Downgrade" ? "outline" : "primary"}
                  disabled={(current && !canRenew) || blocked || (busy && busy !== plan._id)}
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

export function SubscriptionControls({ status, canManage, hasCard, hasPending, accessUntil, billingMode = "auto", currentPlan = null, currency = "NGN", cycle = "monthly", providers }) {
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
      {renewing && currentPlan ? <CheckoutModal plan={currentPlan} action="renew" currency={currency} cycle={cycle} providers={providers} onClose={() => setRenewing(false)} /> : null}
      {manual && cycle !== "lifetime" && currentPlan && !currentPlan.isTrial && ["active", "past_due", "expired"].includes(status) ? (
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
          setState({ status: "pending", message: "Your payment is still processing (or the checkout was closed). If you paid, we'll activate your plan automatically as soon as the payment provider confirms it." });
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
      <p className="mt-2 text-sm text-slate-500">{state.message || "Please wait while we confirm your payment. Don't close this page."}</p>
      {state.status !== "verifying" ? (
        <Link href="/billing" className="mt-6 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700">
          Back to billing →
        </Link>
      ) : null}
    </div>
  );
}
