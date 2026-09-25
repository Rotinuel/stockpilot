import { MapPin, Info } from "lucide-react";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { listLocations } from "@/services/locations";
import { listStaff } from "@/services/staff";
import { hasFeature, limitLabel } from "@/lib/plans";
import { toPlain } from "@/lib/serialize";
import { PageHeader, TableCard, Alert } from "@/components/ui/Misc";
import Badge from "@/components/ui/Badge";
import { AddLocationButton, LocationRowActions } from "@/components/staff/LocationsClient";
import AccessDenied from "@/components/layout/AccessDenied";

export const metadata = { title: "Locations" };

export default async function LocationsPage() {
  const session = await requireTenantSession();
  if (!sessionCan(session, "locations:view")) return <AccessDenied />;
  const { ctx, plan } = session;
  const canManage = sessionCan(session, "locations:manage");
  const [locations, staff] = await Promise.all([listLocations(ctx), canManage ? listStaff(ctx) : { users: [] }]);
  const multi = hasFeature(plan, "multiLocation");
  const staffLite = toPlain(staff.users.filter((u) => u.isActive).map((u) => ({ _id: u._id, name: u.name })));
  const canWrite = canManage && session.access.canWrite;

  return (
    <>
      <PageHeader title="Locations" description="Stores, branches and warehouses. Stock is tracked per location." actions={canManage ? <AddLocationButton staff={staffLite} disabled={!session.access.canWrite} locked={!multi && locations.filter((l) => l.isActive).length >= (plan?.limits?.locations ?? 1)} /> : null} />
      {!multi ? (
        <Alert tone="info" icon={Info} className="mb-6">
          Your plan includes {limitLabel(plan?.limits?.locations)} location. Upgrade to Professional to add branches, transfer stock between them and run the POS per location.
        </Alert>
      ) : null}
      <TableCard>
        <table className="table-base">
          <thead>
            <tr>
              <th>Location</th>
              <th className="hidden sm:table-cell">Phone</th>
              <th className="hidden md:table-cell">Manager</th>
              <th>Status</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {locations.map((l) => (
              <tr key={String(l._id)}>
                <td>
                  <p className="flex items-center gap-2 font-medium text-slate-900">
                    <MapPin className="h-4 w-4 text-slate-400" /> {l.name} {l.isDefault ? <Badge tone="brand">Default</Badge> : null}
                  </p>
                  {l.address ? <p className="pl-6 text-xs text-slate-500">{l.address}</p> : null}
                </td>
                <td className="hidden text-slate-600 sm:table-cell">{l.phone || "—"}</td>
                <td className="hidden text-slate-600 md:table-cell">{l.managerName || "—"}</td>
                <td>{l.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Inactive</Badge>}</td>
                <td>
                  <LocationRowActions location={toPlain(l)} staff={staffLite} canWrite={canWrite} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}
