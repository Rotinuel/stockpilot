"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { planPrice, yearlySaving, isSoldIn } from "@/lib/pricing";
import { cn } from "@/utils/cn";

const money = (v, c) => formatMoney(v, c).replace(/\.00$/, "");

function Toggle({ value, onChange, options, label }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("rounded-lg px-4 py-1.5 text-sm font-semibold transition", value === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}
        >
          {o.label}
          {o.badge ? <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">{o.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Pricing cards rendered from plans stored in MongoDB (never hardcoded). */
export default function Pricing({ plans = [], defaultCurrency = "NGN", trialDays = 3 }) {
  const [cycle, setCycle] = useState("monthly");
  const [currency, setCurrency] = useState(defaultCurrency === "USD" ? "USD" : "NGN");
  const paid = plans.filter((p) => isSoldIn(p, currency, "monthly"));
  const usdAvailable = plans.some((p) => isSoldIn(p, "USD", "monthly"));

  return (
    <section id="pricing" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-brand-600">Pricing</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Simple plans that grow with your shop</h2>
          <p className="mt-4 text-slate-600">
            Every account starts with a {trialDays}-day free trial — no payment required. Pay monthly, or yearly and get 2 months free.{" "}
            {currency === "NGN" ? "Pay by card, bank transfer or USSD." : "Pay by card from anywhere in the world."}
          </p>
        </div>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Toggle
            label="Billing period"
            value={cycle}
            onChange={setCycle}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "annually", label: "Yearly", badge: "2 months free" },
            ]}
          />
          {usdAvailable ? (
            <Toggle
              label="Currency"
              value={currency}
              onChange={setCurrency}
              options={[
                { value: "NGN", label: "₦ Nigeria" },
                { value: "USD", label: "$ Other countries" },
              ]}
            />
          ) : null}
        </div>
        {paid.length ? (
          <div className={cn("mx-auto mt-10 grid max-w-6xl gap-6", paid.length >= 3 ? "lg:grid-cols-3" : "md:grid-cols-2")}>
            {paid.map((plan) => {
              const price = planPrice(plan, currency, cycle);
              const saving = yearlySaving(plan, currency);
              return (
                <div key={String(plan._id)} className={cn("relative flex flex-col rounded-2xl border bg-white p-6 shadow-card sm:p-8", plan.highlight ? "border-brand-500 ring-2 ring-brand-500/20" : "border-slate-200")}>
                  {plan.highlight ? <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">Most popular</span> : null}
                  <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                  <p className="mt-1 min-h-10 text-sm text-slate-500">{plan.description}</p>
                  <p className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight text-slate-900">{money(price, currency)}</span>
                    <span className="text-sm text-slate-500">/{cycle === "annually" ? "year" : "month"}</span>
                  </p>
                  <p className="mt-1 min-h-5 text-sm text-emerald-700">
                    {cycle === "annually" && saving > 0 ? `≈ ${money(price / 12, currency)}/month · save ${money(saving, currency)}` : cycle === "monthly" && saving > 0 ? `or ${money(planPrice(plan, currency, "annually"), currency)}/year` : ""}
                  </p>
                  <Link
                    href={`/register?plan=${plan.code}`}
                    className={cn(
                      "mt-6 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition",
                      plan.highlight ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-slate-300 text-slate-800 hover:bg-slate-50",
                    )}
                  >
                    Start {trialDays}-day free trial
                  </Link>
                  <ul className="mt-8 space-y-3 text-sm">
                    {(plan.featureList || []).map((f) => (
                      <li key={f} className="flex gap-3 text-slate-600">
                        <Check className="h-5 w-5 shrink-0 text-brand-600" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-12 text-center text-sm text-slate-500">Plans are being updated. Start your free trial now — you can choose a plan any time.</p>
        )}
        <p className="mt-8 text-center text-sm text-slate-500">
          No payment required to start your {trialDays}-day trial. Cancel any time — your data is never deleted.{" "}
          {currency === "USD" ? "Prices in US dollars for businesses outside Nigeria." : "Prices in Naira for businesses in Nigeria."}
        </p>
      </div>
    </section>
  );
}
