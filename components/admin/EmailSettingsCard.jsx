"use client";

import { useState } from "react";
import { Mail, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { apiFetch, useAction } from "@/hooks/useApi";

const PROVIDER_LABEL = { smtp: "Built-in SMTP", resend: "Resend", console: "Not set up" };

/** Super Admin: shows how emails are sent (no secrets) and sends a test email. `children`: setup help. */
export default function EmailSettingsCard({ status, defaultTo, children }) {
  const [to, setTo] = useState(defaultTo || "");
  const [result, setResult] = useState(null);
  const { run, loading, errors } = useAction();

  const sendTest = async () => {
    setResult(null);
    const res = await run(() => apiFetch("/api/admin/email-test", { method: "POST", body: { to } }));
    if (res) setResult(res);
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader
        icon={Mail}
        title="Email delivery"
        description="Verification, password-reset, staff invitation and alert emails."
        action={<Badge tone={status.configured ? "green" : "yellow"} dot>{status.configured ? PROVIDER_LABEL[status.provider] : PROVIDER_LABEL.console}</Badge>}
      />
      <CardBody className="space-y-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Sends from</dt>
            <dd className="font-medium break-all text-slate-900">{status.from}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Mail server</dt>
            <dd className="font-medium break-all text-slate-900">{status.server || "—"}</dd>
          </div>
        </dl>

        {status.problem ? (
          <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {status.problem}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Send a test email to" error={errors.to} className="flex-1">
            <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Button icon={Send} loading={loading} onClick={sendTest} disabled={!to}>
            Send test email
          </Button>
        </div>

        {result ? (
          result.delivered ? (
            <p className="flex gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Sent to {result.to}. Check the inbox (and the spam folder the first time).
            </p>
          ) : (
            <p className="flex gap-2 rounded-lg bg-rose-50 p-3 text-sm break-words text-rose-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Not sent: {result.error}
            </p>
          )
        ) : null}

        {children}
      </CardBody>
    </Card>
  );
}
