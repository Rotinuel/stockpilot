import { History } from "lucide-react";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { listAuditLogs } from "@/services/audit";
import { hasFeature } from "@/lib/plans";
import { pageParams, str } from "@/lib/query";
import { escapeRegex } from "@/utils/slug";
import { formatDateTime } from "@/utils/format";
import { ROLE_LABELS } from "@/lib/constants";
import { PageHeader, TableCard, EmptyState } from "@/components/ui/Misc";
import Badge from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";
import { FilterSelect } from "@/components/ui/UrlFilters";
import { UpgradeCard } from "@/components/layout/Banners";
import AccessDenied from "@/components/layout/AccessDenied";

export const metadata = { title: "Audit logs" };

const GROUPS = ["auth", "product", "inventory", "sale", "purchase", "expense", "customer", "supplier", "staff", "subscription", "payment", "settings", "location", "report"];

function summarize(log) {
  const m = log.metadata || {};
  return m.name || m.invoiceNumber || m.referenceNumber || m.email || m.plan || m.reason || (m.amount ? `Amount ${m.amount}` : "") || (m.fields ? m.fields.join(", ") : "");
}

export default async function AuditLogsPage({ searchParams }) {
  const session = await requireTenantSession();
  if (!sessionCan(session, "audit:view")) return <AccessDenied />;
  if (!hasFeature(session.plan, "auditLogs")) {
    return (
      <>
        <PageHeader title="Audit logs" />
        <UpgradeCard title="See who did what, and when" message="Audit logs record logins, product changes, stock adjustments, sales, cancellations, staff changes and billing events. Available on the Professional plan." />
      </>
    );
  }
  const sp = await searchParams;
  const filter = { tenantId: session.ctx.tenantId };
  const action = str(sp, "action", 30);
  if (action && GROUPS.includes(action)) filter.action = { $regex: `^${escapeRegex(action)}\\.` };
  const data = await listAuditLogs(filter, pageParams(sp, 30));
  return (
    <>
      <PageHeader title="Audit logs" description="A tamper-evident trail of important actions in your business." />
      <div className="mb-4">
        <FilterSelect param="action" placeholder="All activity" options={GROUPS.map((g) => ({ value: g, label: g[0].toUpperCase() + g.slice(1) }))} />
      </div>
      {data.items.length ? (
        <TableCard footer={<Pagination page={data.page} pages={data.pages} total={data.total} basePath="/audit-logs" searchParams={sp} label="events" />}>
          <table className="table-base">
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Action</th>
                <th className="hidden md:table-cell">Details</th>
                <th className="hidden lg:table-cell">IP</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((l) => (
                <tr key={String(l._id)}>
                  <td className="whitespace-nowrap text-slate-600">{formatDateTime(l.timestamp, { timeZone: session.ctx.timezone })}</td>
                  <td>
                    <p className="font-medium text-slate-900">{l.userName || "System"}</p>
                    <p className="text-xs text-slate-500">{ROLE_LABELS[l.userRole] || l.userRole}</p>
                  </td>
                  <td>
                    <Badge tone={l.action.includes("delete") || l.action.includes("cancel") ? "red" : l.action.startsWith("auth") ? "blue" : "gray"}>{l.action}</Badge>
                  </td>
                  <td className="hidden max-w-80 truncate text-slate-600 md:table-cell">{String(summarize(l) || "—")}</td>
                  <td className="hidden font-mono text-xs text-slate-500 lg:table-cell">{l.ip || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState icon={History} title="No activity recorded yet" />
        </div>
      )}
    </>
  );
}
