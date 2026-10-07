import { redirect } from "next/navigation";
import Logo from "@/components/layout/Logo";
import Wizard from "@/components/onboarding/Wizard";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { toPlain } from "@/lib/serialize";

export const metadata = { title: "Set up your workspace", robots: { index: false } };

export default async function OnboardingPage() {
  const session = await requireTenantSession();
  const { tenant } = session;
  if (tenant.onboarding?.completed || !sessionCan(session, "settings:business")) redirect("/dashboard");
  const view = toPlain({
    businessName: tenant.businessName,
    phone: tenant.phone,
    email: tenant.email,
    address: tenant.address,
    businessType: tenant.businessType,
    currency: tenant.currency,
    settings: { taxRate: tenant.settings?.taxRate, taxLabel: tenant.settings?.taxLabel },
  });
  return (
    <div className="min-h-screen bg-linear-to-b from-brand-50/60 to-slate-50 px-4 py-8">
      <div className="mx-auto mb-8 flex max-w-2xl items-center justify-between">
        <Logo href="/dashboard" />
        <span className="text-sm text-slate-500">3-day free trial active</span>
      </div>
      <Wizard tenant={view} initialStep={tenant.onboarding?.step || 1} canInvite={sessionCan(session, "staff:manage")} />
    </div>
  );
}
