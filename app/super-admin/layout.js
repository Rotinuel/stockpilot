import AdminShell from "@/components/admin/AdminShell";
import { requireSuperAdminSession } from "@/lib/session";

export const metadata = { title: { default: "Super Admin", template: "%s · Super Admin · StockPilot" }, robots: { index: false, follow: false } };

export default async function SuperAdminLayout({ children }) {
  const session = await requireSuperAdminSession();
  return <AdminShell user={{ name: session.user.name, email: session.user.email }}>{children}</AdminShell>;
}
