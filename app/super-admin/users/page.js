import Link from "next/link";
import { requireSuperAdminSession } from "@/lib/session";
import { listUsers } from "@/services/admin";
import { pageParams, str } from "@/lib/query";
import { toPlain } from "@/lib/serialize";
import { timeAgo } from "@/utils/format";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/constants";
import { PageHeader, TableCard } from "@/components/ui/Misc";
import Badge from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";
import { SearchInput, FilterSelect } from "@/components/ui/UrlFilters";
import UserToggle from "@/components/admin/UserToggle";

export const metadata = { title: "Users" };

export default async function AdminUsersPage({ searchParams }) {
  await requireSuperAdminSession();
  const sp = await searchParams;
  const role = str(sp, "role");
  const data = await listUsers({ ...pageParams(sp, 25), search: str(sp, "q"), role: ALL_ROLES.includes(role) ? role : undefined });
  const items = toPlain(data.items);
  return (
    <>
      <PageHeader title="Users" description={`${data.total} users across all businesses`} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput placeholder="Name, email or phone…" />
        <FilterSelect param="role" placeholder="Any role" options={ALL_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
      </div>
      <TableCard footer={<Pagination page={data.page} pages={data.pages} total={data.total} basePath="/super-admin/users" searchParams={sp} label="users" />}>
        <table className="table-base">
          <thead>
            <tr>
              <th>User</th>
              <th className="hidden md:table-cell">Business</th>
              <th>Role</th>
              <th className="hidden lg:table-cell">Last login</th>
              <th className="text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u._id}>
                <td>
                  <p className="font-medium text-slate-900">{u.name}</p>
                  <p className="text-xs text-slate-500">
                    {u.email} {u.emailVerified ? "" : "· unverified"}
                  </p>
                </td>
                <td className="hidden md:table-cell">{u.tenantId ? <Link href={`/super-admin/tenants/${u.tenantId}`} className="text-brand-700 hover:underline">{u.businessName}</Link> : u.businessName}</td>
                <td>
                  <Badge tone={u.role === "super_admin" ? "yellow" : "brand"}>{ROLE_LABELS[u.role]}</Badge>
                </td>
                <td className="hidden text-slate-500 lg:table-cell">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Never"}</td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Inactive</Badge>}
                    <UserToggle user={{ _id: u._id, email: u.email, isActive: u.isActive, role: u.role }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}
