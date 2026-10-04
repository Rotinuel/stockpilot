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
    referral: {
      enabled: settings.referral?.enabled !== false,
      rewardType: settings.referral?.rewardType || "both",
      rewardDays: String(settings.referral?.rewardDays ?? 30),
      commissionPercent: String(settings.referral?.commissionPercent ?? 10),
    },
  });
  const setRef = (k, val) => setV((s) => ({ ...s, referral: { ...s.referral, [k]: val } }));
  const showDays = v.referral.rewardType !== "commission";
  const showCommission = v.referral.rewardType !== "days";
  const { run, loading, errors } = useAction();
  const submit = (e) => {
    e.preventDefault();
    run(() => apiFetch("/api/admin/settings", { method: "PATCH", body: { ...v, gracePeriodDays: Number(v.gracePeriodDays), referral: { ...v.referral, rewardDays: Number(v.referral.rewardDays) || 0, commissionPercent: Number(v.referral.commissionPercent) || 0 } } }), { success: "Settings saved", refresh: true });
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
        <CardHeader title="Referral programme" description="Reward businesses that bring in new paying customers. Rewards are given once, when the referred business makes its first payment." />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Checkbox className="sm:col-span-3" checked={v.referral.enabled} onChange={(e) => setRef("enabled", e.target.checked)} label="Referral programme is on" description="When off, new sign-ups through referral links aren't recorded (existing ones still earn their reward)." />
          <Field label="Reward">
            <Select value={v.referral.rewardType} onChange={(e) => setRef("rewardType", e.target.value)}>
              <option value="days">Free subscription days</option>
              <option value="commission">Cash commission</option>
              <option value="both">Free days + cash commission</option>
            </Select>
          </Field>
          {showDays ? (
            <Field label="Free days per paying referral" error={errors["referral.rewardDays"]}>
              <Input type="number" min="0" max="365" value={v.referral.rewardDays} onChange={(e) => setRef("rewardDays", e.target.value)} />
            </Field>
          ) : null}
          {showCommission ? (
            <Field label="Commission (% of first payment)" hint="Paid out manually from Referrals." error={errors["referral.commissionPercent"]}>
              <Input type="number" min="0" max="100" step="0.5" value={v.referral.commissionPercent} onChange={(e) => setRef("commissionPercent", e.target.value)} />
            </Field>
          ) : null}
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
