import { ShieldOff } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { SubscriptionBanner, EmailVerifyBanner, AnnouncementBanner } from "@/components/layout/Banners";
import { requireTenantSession, clientSession, sessionCan } from "@/lib/session";
import { permissionsFor } from "@/lib/rbac";
import { countLowStock } from "@/services/stock";
import LogoutButton from "@/components/layout/LogoutButton";

export const metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }) {
  const session = await requireTenantSession();

  if (session.access?.state === "suspended") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <ShieldOff className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">This account has been suspended</h1>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          Access to {session.tenant.businessName} is temporarily disabled. Your data has not been deleted. Please contact {session.platform?.supportEmail || "support"} for help.
        </p>
        <div className="mt-6">
          <LogoutButton />
        </div>
      </main>
    );
  }

  const permissions = permissionsFor(session.user.role, session.tenant.settings);
  const lowStock = sessionCan(session, "inventory:view") ? await countLowStock(session.ctx) : 0;
  const view = clientSession(session);

  return (
    <AppShell session={view} permissions={permissions} badges={{ lowStock }}>
      <AnnouncementBanner
        announcement={session.platform?.announcement ? { active: Boolean(session.platform.announcement.active), message: String(session.platform.announcement.message || ""), level: session.platform.announcement.level || "info" } : null}
      />
      <SubscriptionBanner access={view.access} canManageBilling={sessionCan(session, "billing:view")} />
      {!session.user.emailVerified && session.user.role === "owner" ? <EmailVerifyBanner /> : null}
      {children}
    </AppShell>
  );
}
