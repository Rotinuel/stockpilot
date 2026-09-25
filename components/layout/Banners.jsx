"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, MailWarning, Megaphone, TriangleAlert, CircleAlert } from "lucide-react";
import { Alert } from "@/components/ui/Misc";
import Button from "@/components/ui/Button";
import { apiFetch } from "@/hooks/useApi";
import { useToast } from "@/components/ui/Toast";

const TONE = { info: "info", warning: "warning", urgent: "urgent", danger: "danger" };

/** Trial countdown / subscription state banner (5 days → info, 3 → warning, 1 → urgent, expired → danger). */
export function SubscriptionBanner({ access, canManageBilling }) {
  if (!access?.message || access.state === "active") return null;
  const icon = access.severity === "danger" ? TriangleAlert : access.severity === "urgent" ? CircleAlert : Clock;
  const cta = access.state === "trialing" ? "Choose a plan" : access.state === "cancelled" ? "Manage billing" : "Renew now";
  if (access.state === "trialing" && access.daysLeft > 5) {
    return (
      <Alert tone="info" icon={Clock} className="mb-6" action={canManageBilling ? <Button href="/billing" size="sm" variant="soft">View plans</Button> : null}>
        {access.message} Explore everything — no payment needed during your trial.
      </Alert>
    );
  }
  return (
    <Alert
      tone={TONE[access.severity] || "info"}
      icon={icon}
      className="mb-6"
      title={access.state === "trialing" ? access.message : access.state === "trial_expired" ? "Your free trial has ended" : undefined}
      action={canManageBilling ? <Button href="/billing" size="sm" variant={access.severity === "danger" || access.severity === "urgent" ? "danger" : "primary"}>{cta}</Button> : null}
    >
      {access.state === "trialing" ? "Subscribe now to avoid interruption. Your data will stay safe either way." : access.state === "trial_expired" ? access.message : access.message}
      {!canManageBilling && !access.canWrite ? " Ask the business owner to renew the subscription." : ""}
    </Alert>
  );
}

export function EmailVerifyBanner() {
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const resend = async () => {
    setSending(true);
    try {
      await apiFetch("/api/auth/resend-verification", { method: "POST" });
      toast.success("Verification email sent", "Check your inbox (and spam folder).");
      setHidden(true);
    } catch (err) {
      toast.error("Couldn't send email", err.message);
    } finally {
      setSending(false);
    }
  };
  return (
    <Alert tone="warning" icon={MailWarning} className="mb-6" action={<Button size="sm" variant="outline" onClick={resend} loading={sending}>Resend link</Button>}>
      Please verify your email address so we can reach you about billing and account security.
    </Alert>
  );
}

export function AnnouncementBanner({ announcement }) {
  if (!announcement?.active || !announcement.message) return null;
  return (
    <Alert tone={announcement.level === "warning" ? "warning" : announcement.level === "success" ? "success" : "info"} icon={Megaphone} className="mb-6">
      {announcement.message}
    </Alert>
  );
}

export function ReadOnlyNotice({ access }) {
  if (access?.canWrite) return null;
  return (
    <Alert tone="danger" icon={TriangleAlert} className="mb-6" title="Read-only mode" action={<Button href="/billing" size="sm" variant="danger">Subscribe</Button>}>
      You can view your records, but adding or changing data requires an active subscription.
    </Alert>
  );
}

export function UpgradeCard({ title, message, cta = "View plans" }) {
  return (
    <div className="rounded-2xl border border-dashed border-brand-300 bg-brand-50/50 px-6 py-12 text-center">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{message}</p>
      <Link href="/billing" className="mt-5 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        {cta}
      </Link>
    </div>
  );
}
