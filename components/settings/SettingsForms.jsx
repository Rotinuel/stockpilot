"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, LogOut } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/Field";
import ImageUpload from "@/components/ui/ImageUpload";
import { useConfirm } from "@/components/ui/Confirm";
import { apiFetch, useAction } from "@/hooks/useApi";
import { BUSINESS_TYPES, CURRENCIES, COUNTRIES } from "@/lib/constants";

const TIMEZONES = ["Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Africa/Johannesburg", "Africa/Abidjan", "Europe/London", "America/New_York", "UTC"];

function SaveBar({ loading }) {
  return (
    <div className="flex justify-end border-t border-slate-100 px-5 py-3">
      <Button type="submit" loading={loading} icon={Save}>
        Save changes
      </Button>
    </div>
  );
}

export function BusinessForm({ tenant }) {
  const [v, setV] = useState({
    businessName: tenant.businessName || "",
    email: tenant.email || "",
    phone: tenant.phone || "",
    address: tenant.address || "",
    businessType: tenant.businessType || "",
    logo: tenant.logo || "",
    currency: tenant.currency || "NGN",
    timezone: tenant.timezone || "Africa/Lagos",
    country: tenant.country || "NG",
  });
  const { run, loading, errors } = useAction();
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    run(() => apiFetch("/api/tenant", { method: "PATCH", body: v }), { success: "Business details saved", refresh: true });
  };
  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <CardHeader title="Business profile" description="Shown on receipts and invoices." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Logo" className="sm:col-span-2">
            <ImageUpload kind="logo" value={v.logo} onChange={(url) => setV((s) => ({ ...s, logo: url }))} label="Upload logo" />
          </Field>
          <Field label="Business name" error={errors.businessName} className="sm:col-span-2">
            <Input value={v.businessName} onChange={set("businessName")} />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input type="email" value={v.email} onChange={set("email")} />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <Input value={v.phone} onChange={set("phone")} />
          </Field>
          <Field label="Address" error={errors.address} className="sm:col-span-2">
            <Textarea rows={2} value={v.address} onChange={set("address")} />
          </Field>
          <Field label="Business type">
            <Select value={v.businessType} onChange={set("businessType")}>
              <option value="">—</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Country">
            <Select value={v.country} onChange={set("country")}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Currency" hint="Used for prices, receipts and reports.">
            <Select value={v.currency} onChange={set("currency")}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Time zone" hint="Defines “today” for reports.">
            <Select value={v.timezone} onChange={set("timezone")}>
              {TIMEZONES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
        </CardBody>
        <SaveBar loading={loading} />
      </form>
    </Card>
  );
}

export function InvoiceSettingsForm({ settings }) {
  const [v, setV] = useState({
    taxRate: String(settings.taxRate ?? 0),
    taxLabel: settings.taxLabel || "VAT",
    invoicePrefix: settings.invoicePrefix || "INV",
    purchasePrefix: settings.purchasePrefix || "PO",
    receiptHeader: settings.receiptHeader || "",
    receiptFooter: settings.receiptFooter || "",
    showLogoOnReceipt: settings.showLogoOnReceipt !== false,
  });
  const { run, loading, errors } = useAction();
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    run(() => apiFetch("/api/tenant", { method: "PATCH", body: { settings: { ...v, taxRate: Number(v.taxRate) || 0 } } }), { success: "Settings saved", refresh: true });
  };
  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <CardHeader title="Tax, invoices & receipts" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Tax rate (%)" hint="Nigeria VAT is 7.5%. Use 0 if you don't charge tax." error={errors["settings.taxRate"]}>
            <Input type="number" min="0" max="100" step="0.01" value={v.taxRate} onChange={set("taxRate")} />
          </Field>
          <Field label="Tax label" error={errors["settings.taxLabel"]}>
            <Input value={v.taxLabel} onChange={set("taxLabel")} />
          </Field>
          <Field label="Invoice number prefix" hint="e.g. INV → INV-000123" error={errors["settings.invoicePrefix"]}>
            <Input value={v.invoicePrefix} onChange={set("invoicePrefix")} />
          </Field>
          <Field label="Purchase number prefix" error={errors["settings.purchasePrefix"]}>
            <Input value={v.purchasePrefix} onChange={set("purchasePrefix")} />
          </Field>
          <Field label="Receipt header" className="sm:col-span-2" hint="e.g. RC number, opening hours">
            <Input value={v.receiptHeader} onChange={set("receiptHeader")} />
          </Field>
          <Field label="Receipt footer" className="sm:col-span-2">
            <Input value={v.receiptFooter} onChange={set("receiptFooter")} />
          </Field>
          <Checkbox className="sm:col-span-2" checked={v.showLogoOnReceipt} onChange={set("showLogoOnReceipt")} label="Show logo on receipts" />
        </CardBody>
        <SaveBar loading={loading} />
      </form>
    </Card>
  );
}

export function NotificationSettingsForm({ settings, isOwner }) {
  const [v, setV] = useState({
    lowStockNotifications: settings.lowStockNotifications !== false,
    emailNotifications: settings.emailNotifications !== false,
    allowCashierReports: Boolean(settings.allowCashierReports),
  });
  const { run, loading } = useAction();
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.checked }));
  const submit = (e) => {
    e.preventDefault();
    const { allowCashierReports, ...rest } = v;
    const body = { settings: isOwner ? v : rest };
    run(() => apiFetch("/api/tenant", { method: "PATCH", body }), { success: "Preferences saved", refresh: true });
  };
  return (
    <Card>
      <form onSubmit={submit}>
        <CardHeader title="Notifications & permissions" />
        <CardBody className="space-y-5">
          <Checkbox checked={v.lowStockNotifications} onChange={set("lowStockNotifications")} label="Low-stock alerts" description="Notify owner, admins, managers and inventory staff when products run low (Business plan and above)." />
          <Checkbox checked={v.emailNotifications} onChange={set("emailNotifications")} label="Email notifications" description="Also send billing and important alerts to owners and admins by email." />
          {isOwner ? <Checkbox checked={v.allowCashierReports} onChange={set("allowCashierReports")} label="Let cashiers view sales reports" description="Cashiers can see the Sales report (never profit, expenses or billing)." /> : null}
        </CardBody>
        <SaveBar loading={loading} />
      </form>
    </Card>
  );
}

export function AccountForm({ user, allowAvatar = true }) {
  const [v, setV] = useState({ name: user.name || "", phone: user.phone || "", avatar: user.avatar || "" });
  const { run, loading, errors } = useAction();
  const submit = (e) => {
    e.preventDefault();
    run(() => apiFetch("/api/account", { method: "PATCH", body: v }), { success: "Profile updated", refresh: true });
  };
  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <CardHeader title="My profile" description={user.email} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          {allowAvatar ? (
            <Field label="Profile image" className="sm:col-span-2">
              <ImageUpload kind="avatar" value={v.avatar} onChange={(url) => setV((s) => ({ ...s, avatar: url }))} label="Upload photo" />
            </Field>
          ) : null}
          <Field label="Full name" error={errors.name}>
            <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <Input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
          </Field>
          <Field label="Email" hint="Contact support to change your sign-in email." className="sm:col-span-2">
            <Input value={user.email} disabled readOnly />
          </Field>
        </CardBody>
        <SaveBar loading={loading} />
      </form>
    </Card>
  );
}

export function SecurityForm() {
  const [v, setV] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const { run, loading, errors, setErrors } = useAction();
  const confirm = useConfirm();
  const router = useRouter();
  const submit = async (e) => {
    e.preventDefault();
    if (v.newPassword !== v.confirm) return setErrors({ confirm: "Passwords do not match" });
    const res = await run(() => apiFetch("/api/account/password", { method: "POST", body: { currentPassword: v.currentPassword, newPassword: v.newPassword } }), { success: "Password changed" });
    if (res) setV({ currentPassword: "", newPassword: "", confirm: "" });
  };
  const logoutAll = async () => {
    if (await confirm({ title: "Sign out other devices?", message: "Every other browser and phone signed in to your account will be signed out.", confirmLabel: "Sign out others" }))
      await run(() => apiFetch("/api/auth/logout-all", { method: "POST" }), { success: "Other sessions signed out" });
    router.refresh();
  };
  return (
    <div className="space-y-6">
      <Card>
        <form onSubmit={submit} noValidate>
          <CardHeader title="Change password" />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Field label="Current password" error={errors.currentPassword}>
              <Input type="password" autoComplete="current-password" value={v.currentPassword} onChange={(e) => setV({ ...v, currentPassword: e.target.value })} />
            </Field>
            <Field label="New password" error={errors.newPassword}>
              <Input type="password" autoComplete="new-password" value={v.newPassword} onChange={(e) => setV({ ...v, newPassword: e.target.value })} />
            </Field>
            <Field label="Confirm new password" error={errors.confirm}>
              <Input type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} />
            </Field>
          </CardBody>
          <SaveBar loading={loading} />
        </form>
      </Card>
      <Card>
        <CardHeader title="Sessions" description="Signed in on a shared or lost device?" action={<Button variant="outline" icon={LogOut} onClick={logoutAll}>Sign out other devices</Button>} />
      </Card>
    </div>
  );
}
