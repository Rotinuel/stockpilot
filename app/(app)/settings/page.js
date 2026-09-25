import { Building2, Receipt, Bell, UserRound, Shield } from "lucide-react";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { toPlain } from "@/lib/serialize";
import { str } from "@/lib/query";
import { PageHeader } from "@/components/ui/Misc";
import LinkTabs from "@/components/ui/LinkTabs";
import { BusinessForm, InvoiceSettingsForm, NotificationSettingsForm, AccountForm, SecurityForm } from "@/components/settings/SettingsForms";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }) {
  const session = await requireTenantSession();
  const sp = await searchParams;
  const canBusiness = sessionCan(session, "settings:business");
  const tabs = [
    ...(canBusiness
      ? [
          { key: "business", label: "Business", href: "/settings?tab=business", icon: Building2 },
          { key: "invoices", label: "Tax & receipts", href: "/settings?tab=invoices", icon: Receipt },
          { key: "notifications", label: "Notifications", href: "/settings?tab=notifications", icon: Bell },
        ]
      : []),
    { key: "account", label: "My account", href: "/settings?tab=account", icon: UserRound },
    { key: "security", label: "Security", href: "/settings?tab=security", icon: Shield },
  ];
  const requested = str(sp, "tab");
  const tab = tabs.some((t) => t.key === requested) ? requested : tabs[0].key;
  // Only pass the fields each form needs to the client.
  const t = session.tenant;
  const tenant = toPlain({
    businessName: t.businessName,
    email: t.email,
    phone: t.phone,
    address: t.address,
    businessType: t.businessType,
    logo: t.logo,
    currency: t.currency,
    timezone: t.timezone,
    country: t.country,
    settings: t.settings || {},
  });
  const user = toPlain({ name: session.user.name, email: session.user.email, phone: session.user.phone, avatar: session.user.avatar });

  return (
    <>
      <PageHeader title="Settings" description={canBusiness ? "Manage your business profile, receipts and your own account." : "Manage your account."} />
      <LinkTabs tabs={tabs} active={tab} className="mb-6" />
      <div className="max-w-3xl">
        {tab === "business" ? <BusinessForm tenant={tenant} /> : null}
        {tab === "invoices" ? <InvoiceSettingsForm settings={tenant.settings || {}} /> : null}
        {tab === "notifications" ? <NotificationSettingsForm settings={tenant.settings || {}} isOwner={session.user.role === "owner"} /> : null}
        {tab === "account" ? <AccountForm user={user} /> : null}
        {tab === "security" ? <SecurityForm /> : null}
      </div>
    </>
  );
}
