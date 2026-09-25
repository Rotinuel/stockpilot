"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Store, Package, Percent, UserPlus, PartyPopper, Check, ArrowRight, ArrowLeft, Plus } from "lucide-react";
import Button from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { apiFetch, useAction } from "@/hooks/useApi";
import { BUSINESS_TYPES, CURRENCIES, UNITS, ROLE_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { cn } from "@/utils/cn";

const STEPS = [
  { title: "Business information", icon: Building2 },
  { title: "Business type", icon: Store },
  { title: "Add your first products", icon: Package, optional: true },
  { title: "Currency & tax", icon: Percent },
  { title: "Invite your team", icon: UserPlus, optional: true },
  { title: "You're ready!", icon: PartyPopper },
];

export default function Wizard({ tenant, initialStep = 1, canInvite }) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 1), 6));
  const [info, setInfo] = useState({ businessName: tenant.businessName || "", phone: tenant.phone || "", email: tenant.email || "", address: tenant.address || "" });
  const [type, setType] = useState(tenant.businessType || "");
  const [money, setMoney] = useState({ currency: tenant.currency || "NGN", taxRate: String(tenant.settings?.taxRate ?? 0), taxLabel: tenant.settings?.taxLabel || "VAT" });
  const [products, setProducts] = useState([]);
  const [draft, setDraft] = useState({ name: "", sellingPrice: "", costPrice: "", quantity: "", unit: "piece" });
  const [invites, setInvites] = useState([]);
  const [invite, setInvite] = useState({ email: "", role: "cashier" });
  const { run, loading, errors } = useAction();

  const save = async (n, data) => {
    const res = await run(() => apiFetch("/api/onboarding", { method: "PATCH", body: { step: n, data } }));
    if (res) setStep(n + 1);
  };
  const next = () => {
    if (step === 1) return save(1, info);
    if (step === 2) return save(2, { businessType: type });
    if (step === 3) return save(3, {});
    if (step === 4) return save(4, money);
    if (step === 5) return save(5, {});
  };
  const finish = async () => {
    const res = await run(() => apiFetch("/api/onboarding", { method: "POST" }));
    if (res) {
      router.replace("/dashboard");
      router.refresh();
    }
  };
  const addProduct = async (e) => {
    e.preventDefault();
    const res = await run(() => apiFetch("/api/products", { method: "POST", body: { ...draft, minimumStockLevel: 5 } }), { success: "Product added" });
    if (res) {
      setProducts((p) => [...p, res.product]);
      setDraft({ name: "", sellingPrice: "", costPrice: "", quantity: "", unit: "piece" });
    }
  };
  const sendInvite = async (e) => {
    e.preventDefault();
    const res = await run(() => apiFetch("/api/staff", { method: "POST", body: invite }), { success: "Invitation created" });
    if (res) {
      setInvites((i) => [...i, { ...invite, link: res.inviteLink, emailSent: res.emailSent }]);
      setInvite({ email: "", role: "cashier" });
    }
  };

  const S = STEPS[step - 1];
  return (
    <div className="mx-auto w-full max-w-2xl">
      <ol className="mb-8 flex items-center gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex flex-1 items-center gap-2">
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", i + 1 < step ? "bg-brand-600 text-white" : i + 1 === step ? "bg-brand-100 text-brand-700 ring-2 ring-brand-600" : "bg-slate-100 text-slate-400")}>
              {i + 1 < step ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            {i < STEPS.length - 1 ? <span className={cn("h-0.5 flex-1 rounded", i + 1 < step ? "bg-brand-600" : "bg-slate-200")} /> : null}
          </li>
        ))}
      </ol>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <S.icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-500">
              Step {step} of 6 {S.optional ? "· optional" : ""}
            </p>
            <h1 className="text-lg font-semibold text-slate-900">{S.title}</h1>
          </div>
        </div>

        {step === 1 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" className="sm:col-span-2" error={errors["data.businessName"]}>
              <Input value={info.businessName} onChange={(e) => setInfo({ ...info, businessName: e.target.value })} />
            </Field>
            <Field label="Business phone">
              <Input value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} />
            </Field>
            <Field label="Business email">
              <Input type="email" value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} />
            </Field>
            <Field label="Address" className="sm:col-span-2" hint="Printed on your receipts">
              <Textarea rows={2} value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} />
            </Field>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BUSINESS_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} className={cn("rounded-xl border px-3 py-3 text-left text-sm font-medium transition", type === t ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-700 hover:bg-slate-50")}>
                {t}
              </button>
            ))}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <form onSubmit={addProduct} className="grid gap-3 sm:grid-cols-6">
              <Field label="Product name" className="sm:col-span-6" error={errors.name}>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Indomie Chicken 70g" />
              </Field>
              <Field label="Selling price" className="sm:col-span-2" error={errors.sellingPrice}>
                <Input type="number" min="0" step="0.01" value={draft.sellingPrice} onChange={(e) => setDraft({ ...draft, sellingPrice: e.target.value })} />
              </Field>
              <Field label="Cost price" className="sm:col-span-2">
                <Input type="number" min="0" step="0.01" value={draft.costPrice} onChange={(e) => setDraft({ ...draft, costPrice: e.target.value })} />
              </Field>
              <Field label="Opening stock" className="sm:col-span-1">
                <Input type="number" min="0" step="any" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
              </Field>
              <Field label="Unit" className="sm:col-span-1">
                <Select value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })}>
                  {UNITS.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </Select>
              </Field>
              <div className="sm:col-span-6">
                <Button type="submit" variant="soft" icon={Plus} loading={loading} disabled={!draft.name || !draft.sellingPrice}>
                  Add product
                </Button>
              </div>
            </form>
            {products.length ? (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {products.map((p) => (
                  <li key={p._id} className="flex justify-between px-3 py-2 text-sm">
                    <span>{p.name}</span>
                    <span className="text-slate-500">
                      {formatMoney(p.sellingPrice, money.currency)} · {p.quantity} {p.unit}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">You can also import a CSV later from the Products page.</p>
            )}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Currency" className="sm:col-span-3">
              <Select value={money.currency} onChange={(e) => setMoney({ ...money, currency: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tax rate (%)" className="sm:col-span-2" hint="Nigeria VAT is 7.5%. Leave 0 if you don't charge tax.">
              <Input type="number" min="0" max="100" step="0.01" value={money.taxRate} onChange={(e) => setMoney({ ...money, taxRate: e.target.value })} />
            </Field>
            <Field label="Tax label">
              <Input value={money.taxLabel} onChange={(e) => setMoney({ ...money, taxLabel: e.target.value })} />
            </Field>
          </div>
        ) : null}

        {step === 5 ? (
          canInvite ? (
            <div className="space-y-4">
              <form onSubmit={sendInvite} className="flex flex-col gap-2 sm:flex-row">
                <Input type="email" placeholder="colleague@email.com" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
                <Select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })} className="sm:w-48">
                  {["admin", "manager", "cashier", "inventory_staff"].map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </Select>
                <Button type="submit" loading={loading} disabled={!invite.email}>
                  Invite
                </Button>
              </form>
              {invites.map((i) => (
                <div key={i.email} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="font-medium">
                    {i.email} · {ROLE_LABELS[i.role]}
                  </p>
                  {!i.emailSent ? <p className="mt-1 break-all text-xs text-slate-500">Share this link: {i.link}</p> : <p className="text-xs text-emerald-600">Invitation emailed</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Only the owner or an admin can invite staff.</p>
          )
        ) : null}

        {step === 6 ? (
          <div className="space-y-3 text-sm text-slate-600">
            <p>Your workspace is set up. Your 7-day free trial is running — explore everything, no payment needed.</p>
            <ul className="space-y-2">
              {["Open the POS and record a sale", "Add or import the rest of your products", "Record a purchase when stock arrives", "Check the dashboard for today's numbers"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" /> {t}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
          {step > 1 ? (
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {S.optional ? (
              <Button variant="outline" onClick={() => save(step, {})} loading={loading}>
                Skip
              </Button>
            ) : null}
            {step < 6 ? (
              <Button onClick={next} loading={loading} disabled={step === 2 && !type}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={finish} loading={loading}>
                Go to dashboard
              </Button>
            )}
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-sm">
        <button type="button" onClick={finish} className="text-slate-500 hover:text-slate-800">
          Skip setup for now
        </button>
      </p>
    </div>
  );
}
