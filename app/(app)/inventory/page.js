import Link from "next/link";
import { History, TriangleAlert } from "lucide-react";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { listMovements, countLowStock } from "@/services/stock";
import { listLocations } from "@/services/locations";
import { pageParams, str, optionalDateRange } from "@/lib/query";
import { toPlain } from "@/lib/serialize";
import { formatDateTime } from "@/utils/format";
import { MOVEMENT_TYPES, MOVEMENT_TYPE_LABELS } from "@/lib/constants";
import { RANGE_PRESETS } from "@/utils/dates";
import { hasFeature } from "@/lib/plans";
import { PageHeader, EmptyState, TableCard } from "@/components/ui/Misc";
import Badge from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";
import LinkTabs from "@/components/ui/LinkTabs";
import { SearchInput, FilterSelect } from "@/components/ui/UrlFilters";
import InventoryActions from "@/components/inventory/InventoryActions";
import AccessDenied from "@/components/layout/AccessDenied";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }) {
  const session = await requireTenantSession();
  if (!sessionCan(session, "inventory:view")) return <AccessDenied />;
  const sp = await searchParams;
  const { ctx } = session;
  const type = str(sp, "type");
  const productId = str(sp, "product");
  const [data, lowCount, locations] = await Promise.all([
    listMovements(ctx, {
      ...pageParams(sp),
      ...optionalDateRange(sp, ctx.timezone),
      type: MOVEMENT_TYPES.includes(type) ? type : undefined,
      productId: productId && /^[a-f0-9]{24}$/i.test(productId) ? productId : undefined,
      search: str(sp, "q"),
    }),
    countLowStock(ctx),
    listLocations(ctx, { activeOnly: true }),
  ]);
  const multi = locations.length > 1;

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Every stock change — purchases, sales, adjustments, returns, damages and transfers."
        actions={
          <InventoryActions
            locations={toPlain(locations)}
            canAdjust={sessionCan(session, "inventory:adjust")}
            canTransfer={sessionCan(session, "inventory:transfer")}
            transferLocked={!hasFeature(session.plan, "multiLocation")}
            canWrite={session.access.canWrite}
          />
        }
      />
      <LinkTabs
        className="mb-5"
        active="movements"
        tabs={[
          { key: "movements", label: "Stock movements", href: "/inventory", icon: History },
          { key: "low", label: "Low stock", href: "/inventory/low-stock", icon: TriangleAlert, badge: lowCount || null },
        ]}
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput placeholder="Search product…" />
        <FilterSelect param="type" placeholder="All movement types" options={MOVEMENT_TYPES.map((t) => ({ value: t, label: MOVEMENT_TYPE_LABELS[t] }))} />
        <FilterSelect param="range" placeholder="All time" options={RANGE_PRESETS.filter((r) => r.value !== "custom")} />
        {productId ? (
          <Link href="/inventory" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Clear product filter ×
          </Link>
        ) : null}
      </div>
      {data.items.length ? (
        <TableCard footer={<Pagination page={data.page} pages={data.pages} total={data.total} basePath="/inventory" searchParams={sp} label="movements" />}>
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Type</th>
                <th className="text-right">Change</th>
                <th className="hidden text-right sm:table-cell">Before → After</th>
                {multi ? <th className="hidden md:table-cell">Location</th> : null}
                <th className="hidden lg:table-cell">Reason / reference</th>
                <th className="hidden xl:table-cell">By</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => (
                <tr key={String(m._id)}>
                  <td className="whitespace-nowrap text-slate-600">{formatDateTime(m.createdAt, { timeZone: ctx.timezone })}</td>
                  <td>
                    <Link href={`/products/${m.productId}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {m.productName}
                    </Link>
                  </td>
                  <td>
                    <Badge tone={m.type === "sale" ? "blue" : m.type === "damage" ? "red" : m.type === "purchase" ? "green" : m.type === "transfer" ? "purple" : "gray"}>{MOVEMENT_TYPE_LABELS[m.type]}</Badge>
                  </td>
                  <td className={`text-right font-semibold tabular-nums ${m.quantity >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {m.quantity > 0 ? "+" : ""}
                    {m.quantity}
                  </td>
                  <td className="hidden text-right text-slate-500 tabular-nums sm:table-cell">
                    {m.previousQuantity} → {m.newQuantity}
                  </td>
                  {multi ? <td className="hidden text-slate-600 md:table-cell">{m.locationName}</td> : null}
                  <td className="hidden max-w-72 truncate text-slate-600 lg:table-cell">
                    {m.referenceType === "Sale" && m.referenceId ? (
                      <Link href={`/sales/${m.referenceId}`} className="text-brand-700 hover:underline">
                        {m.reason}
                      </Link>
                    ) : m.referenceType === "Purchase" && m.referenceId ? (
                      <Link href={`/purchases/${m.referenceId}`} className="text-brand-700 hover:underline">
                        {m.reason}
                      </Link>
                    ) : (
                      m.reason
                    )}
                  </td>
                  <td className="hidden text-slate-500 xl:table-cell">{m.performedByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState icon={History} title="No stock movements found" description="Movements are recorded automatically for sales, purchases and adjustments." />
        </div>
      )}
    </>
  );
}
