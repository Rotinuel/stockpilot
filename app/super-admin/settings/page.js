import { requireSuperAdminSession } from "@/lib/session";
import { getPlatformSettings } from "@/services/platform";
import { toPlain } from "@/lib/serialize";
import { PageHeader } from "@/components/ui/Misc";
import PlatformSettingsForm from "@/components/admin/PlatformSettingsForm";
import EmailSettingsCard from "@/components/admin/EmailSettingsCard";
import EmailSetupHelp from "@/components/admin/EmailSetupHelp";
import { emailStatus } from "@/lib/email";
import { SecurityForm, AccountForm } from "@/components/settings/SettingsForms";

export const metadata = { title: "Global settings" };

export default async function PlatformSettingsPage() {
  const session = await requireSuperAdminSession();
  const settings = toPlain(await getPlatformSettings());
  return (
    <>
      <PageHeader title="Global settings" description="Platform-wide configuration." />
      <PlatformSettingsForm settings={settings} />
      <h2 className="mt-10 mb-4 text-lg font-semibold text-slate-900">Email</h2>
      <EmailSettingsCard status={emailStatus()} defaultTo={session.user.email}>
        <EmailSetupHelp />
      </EmailSettingsCard>
      <h2 className="mt-10 mb-4 text-lg font-semibold text-slate-900">Your super admin account</h2>
      <div className="max-w-3xl space-y-6">
        <AccountForm user={toPlain({ name: session.user.name, email: session.user.email, phone: session.user.phone, avatar: "" })} allowAvatar={false} />
        <SecurityForm />
      </div>
    </>
  );
}
