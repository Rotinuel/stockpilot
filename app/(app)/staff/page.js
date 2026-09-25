import { UserCog, Mail } from "lucide-react";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { listStaff } from "@/services/staff";
import { listLocations } from "@/services/locations";
import { getUsage } from "@/services/limits";
import { assignableRoles, canManageUser } from "@/lib/rbac";
import { limitLabel } from "@/lib/plans";
import { toPlain } from "@/lib/serialize";
import { formatDate, timeAgo } from "@/utils/format";
import { ROLE_LABELS } from "@/lib/constants";
import { PageHeader, TableCard, Avatar, ProgressBar } from "@/components/ui/Misc";
import { Card, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { InviteButton, StaffRowControls, RevokeInviteButton } from "@/components/staff/StaffClient";
import AccessDenied from "@/components/layout/AccessDenied";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const session = await requireTenantSession();
  if (!sessionCan(session, "staff:view")) return <AccessDenied />;
  const { ctx, user: me, plan } = session;
  const [data, locations, usage] = await Promise.all([listStaff(ctx), listLocations(ctx, { activeOnly: true }), getUsage(ctx.tenantId, { timezone: ctx.timezone })]);
  const roles = assignableRoles(me.role);
  const canManage = sessionCan(session, "staff:manage");
  const limit = plan?.limits?.staffUsers;

  return (
    <>
      <PageHeader title="Staff" description="Invite your team and control what each person can do." actions={canManage ? <InviteButton roles={roles} locations={toPlain(locations)} disabled={!session.access.canWrite} /> : null} />
      <Card className="mb-6">
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Staff seats</p>
            <p className="text-xs text-slate-500">
              {usage.staffUsers} of {limitLabel(limit)} used on the {plan?.name} plan (owner not counted; pending invites count).
            </p>
          </div>
          <ProgressBar value={usage.staffUsers} max={limit} className="sm:w-64" />
        </CardBody>
      </Card>
      <TableCard>
        <table className="table-base">
          <thead>
            <tr>
              <th>Member</th>
              <th className="hidden md:table-cell">Status</th>
              <th className="hidden lg:table-cell">Last active</th>
              <th className="text-right">Role</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={String(u._id)} className={u.isActive ? "" : "opacity-60"}>
                <td>
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} src={u.avatar} size="sm" />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">
                        {u.name} {String(u._id) === String(me._id) ? <span className="text-xs text-slate-400">(you)</span> : null}
                      </p>
                      <p className="truncate text-xs text-slate-500">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="hidden md:table-cell">{u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Deactivated</Badge>}</td>
                <td className="hidden text-slate-500 lg:table-cell">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Never"}</td>
                <td className="text-right">
                  {u.role === "owner" ? (
                    <Badge tone="purple">{ROLE_LABELS.owner}</Badge>
                  ) : (
                    <StaffRowControls user={toPlain({ _id: u._id, name: u.name, role: u.role, isActive: u.isActive })} roles={roles} editable={canManage && canManageUser({ _id: me._id, role: me.role, tenantId: me.tenantId }, { ...u, tenantId: me.tenantId })} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
      {data.invitations.length ? (
        <>
          <h2 className="mt-8 mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Mail className="h-4 w-4" /> Pending invitations
          </h2>
          <TableCard>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th className="hidden sm:table-cell">Expires</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.invitations.map((i) => (
                  <tr key={String(i._id)}>
                    <td>{i.email}</td>
                    <td>
                      <Badge tone="brand">{ROLE_LABELS[i.role]}</Badge>
                    </td>
                    <td className="hidden sm:table-cell">{i.expired ? <Badge tone="red">Expired</Badge> : formatDate(i.expiresAt)}</td>
                    <td className="text-right">{canManage ? <RevokeInviteButton id={String(i._id)} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </>
      ) : null}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["admin", "manager", "cashier", "inventory_staff"].map((r) => (
          <div key={r} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <UserCog className="h-4 w-4 text-brand-600" /> {ROLE_LABELS[r]}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {
                {
                  admin: "Full access except subscription ownership controls.",
                  manager: "Products, inventory, sales, purchases, customers, suppliers and reports.",
                  cashier: "POS, products (view), their own sales and customers. No deleting or financial reports.",
                  inventory_staff: "View products, add and adjust stock, inventory reports.",
                }[r]
              }
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
