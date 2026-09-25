import Link from "next/link";
import { Check } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { cn } from "@/utils/cn";

const INTERVAL = { monthly: "month", quarterly: "quarter", biannually: "6 months", annually: "year" };

/** Pricing cards rendered from plans stored in MongoDB (never hardcoded). */
export default function Pricing({ plans = [] }) {
  const paid = plans.filter((p) => !p.isTrial);
  const trial = plans.find((p) => p.isTrial);
  return (
    <section id="pricing" className="scroll-mt-20 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-brand-600">Pricing</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Simple plans that grow with your shop</h2>
          <p className="mt-4 text-slate-600">
            Every account starts with a {trial?.durationDays || 7}-day free trial. No payment required to start. Pay monthly with card, bank transfer or USSD via Paystack.
          </p>
        </div>
        {paid.length ? (
          <div className={cn("mx-auto mt-12 grid max-w-6xl gap-6", paid.length >= 3 ? "lg:grid-cols-3" : "md:grid-cols-2")}>
            {paid.map((plan) => (
              <div key={String(plan._id)} className={cn("relative flex flex-col rounded-2xl border bg-white p-6 shadow-card sm:p-8", plan.highlight ? "border-brand-500 ring-2 ring-brand-500/20" : "border-slate-200")}>
                {plan.highlight ? <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">Most popular</span> : null}
                <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                <p className="mt-1 min-h-10 text-sm text-slate-500">{plan.description}</p>
                <p className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-slate-900">{formatMoney(plan.price, plan.currency).replace(/\.00$/, "")}</span>
                  <span className="text-sm text-slate-500">/{INTERVAL[plan.interval] || "month"}</span>
                </p>
                <Link
                  href={`/register?plan=${plan.code}`}
                  className={cn(
                    "mt-6 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition",
                    plan.highlight ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-slate-300 text-slate-800 hover:bg-slate-50",
                  )}
                >
                  Start 7-day free trial
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
            ))}
          </div>
        ) : (
          <p className="mt-12 text-center text-sm text-slate-500">Plans are being updated. Start your free trial now — you can choose a plan any time.</p>
        )}
        <p className="mt-8 text-center text-sm text-slate-500">No payment required to start your 7-day trial. Cancel any time — your data is never deleted.</p>
      </div>
    </section>
  );
}
