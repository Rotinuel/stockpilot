"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Field, Input, Select, Checkbox } from "@/components/ui/Field";
import { apiFetch, useAction } from "@/hooks/useApi";

export default function PlatformSettingsForm({ settings }) {
  const [v, setV] = useState({
    gracePeriodDays: String(settings.gracePeriodDays ?? 3),
    allowRegistrations: settings.allowRegistrations !== false,
    supportEmail: settings.supportEmail || "",
    supportPhone: settings.supportPhone || "",
    defaultCurrency: settings.defaultCurrency || "NGN",
    announcement: { active: Boolean(settings.announcement?.active), message: settings.announcement?.message || "", level: settings.announcement?.level || "info" },
  });
  const { run, loading, errors } = useAction();
  const submit = (e) => {
    e.preventDefault();
    run(() => apiFetch("/api/admin/settings", { method: "PATCH", body: { ...v, gracePeriodDays: Number(v.gracePeriodDays) } }), { success: "Settings saved", refresh: true });
  };
  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6">
      <Card>
        <CardHeader title="Billing & access" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Grace period after failed payment (days)" hint="Businesses keep full access this long before becoming read-only." error={errors.gracePeriodDays}>
            <Input type="number" min="0" max="30" value={v.gracePeriodDays} onChange={(e) => setV({ ...v, gracePeriodDays: e.target.value })} />
          </Field>
          <Field label="Default currency">
            <Input value={v.defaultCurrency} maxLength={3} onChange={(e) => setV({ ...v, defaultCurrency: e.target.value.toUpperCase() })} />
          </Field>
          <Checkbox className="sm:col-span-2" checked={v.allowRegistrations} onChange={(e) => setV({ ...v, allowRegistrations: e.target.checked })} label="Allow new registrations" description="Turn off to pause sign-ups (existing businesses are unaffected)." />
          <p className="text-xs text-slate-500 sm:col-span-2">The free trial is fixed at exactly 7 days by business rule.</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Support contact" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Support email" error={errors.supportEmail}>
            <Input type="email" value={v.supportEmail} onChange={(e) => setV({ ...v, supportEmail: e.target.value })} />
          </Field>
          <Field label="Support phone">
            <Input value={v.supportPhone} onChange={(e) => setV({ ...v, supportPhone: e.target.value })} />
          </Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Banner announcement" description="Shown at the top of every business dashboard while active." />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label="Message" className="sm:col-span-2">
            <Input value={v.announcement.message} onChange={(e) => setV({ ...v, announcement: { ...v.announcement, message: e.target.value } })} />
          </Field>
          <Field label="Style">
            <Select value={v.announcement.level} onChange={(e) => setV({ ...v, announcement: { ...v.announcement, level: e.target.value } })}>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="success">Success</option>
            </Select>
          </Field>
          <Checkbox className="sm:col-span-3" checked={v.announcement.active} onChange={(e) => setV({ ...v, announcement: { ...v.announcement, active: e.target.checked } })} label="Show banner" />
        </CardBody>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" icon={Save} loading={loading}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
