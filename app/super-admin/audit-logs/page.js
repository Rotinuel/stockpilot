import { requireSuperAdminSession } from "@/lib/session";
import { listPlatformAudit } from "@/services/admin";
import { pageParams, str } from "@/lib/query";
import { toPlain } from "@/lib/serialize";
import { formatDateTime } from "@/utils/format";
import { PageHeader, TableCard } from "@/components/ui/Misc";
import Badge from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/UrlFilters";

export const metadata = { title: "Audit logs" };

export default async function AdminAuditPage({ searchParams }) {
  await requireSuperAdminSession();
  const sp = await searchParams;
  const data = await listPlatformAudit({ ...pageParams(sp, 30), action: str(sp, "q", 40), tenantId: str(sp, "tenant") });
  const items = toPlain(data.items);
  return (
    <>
      <PageHeader title="Audit logs" description="Platform-wide activity, including super admin actions." />
      <div className="mb-4">
        <SearchInput placeholder="Filter by action prefix, e.g. tenant. or payment." />
      </div>
      <TableCard footer={<Pagination page={data.page} pages={data.pages} total={data.total} basePath="/super-admin/audit-logs" searchParams={sp} label="events" />}>
        <table className="table-base">
          <thead>
            <tr>
              <th>When</th>
              <th>Business</th>
              <th>User</th>
              <th>Action</th>
              <th className="hidden lg:table-cell">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a._id}>
                <td className="whitespace-nowrap text-slate-600">{formatDateTime(a.timestamp)}</td>
                <td className="text-slate-700">{a.businessName}</td>
                <td>
                  <p className="text-slate-800">{a.userName || "System"}</p>
                  <p className="text-xs text-slate-500">{a.userRole}</p>
                </td>
                <td>
                  <Badge tone={a.userRole === "super_admin" ? "yellow" : "gray"}>{a.action}</Badge>
                </td>
                <td className="hidden max-w-96 truncate font-mono text-xs text-slate-500 lg:table-cell">{JSON.stringify(a.metadata || {})}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}
