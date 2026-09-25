import { requireTenantSession } from "@/lib/session";
import { listNotifications } from "@/services/notifications";
import { toPlain } from "@/lib/serialize";
import { PageHeader } from "@/components/ui/Misc";
import NotificationList from "@/components/layout/NotificationList";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await requireTenantSession();
  const data = await listNotifications(session.ctx, { limit: 50 });
  return (
    <>
      <PageHeader title="Notifications" description="Stock alerts, billing updates and announcements." />
      <NotificationList items={toPlain(data.items)} unread={data.unread} />
    </>
  );
}
