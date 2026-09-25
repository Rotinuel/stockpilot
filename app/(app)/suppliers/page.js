import Link from "next/link";
import { Factory, HandCoins } from "lucide-react";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { listSuppliers } from "@/services/suppliers";
import { pageParams, str } from "@/lib/query";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/utils/format";
import { PageHeader, EmptyState, TableCard, StatCard } from "@/components/ui/Misc";
import Badge from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";
import { SearchInput, FilterSelect } from "@/components/ui/UrlFilters";
import { AddPartyButton } from "@/components/parties/PartyForms";
import AccessDenied from "@/components/layout/AccessDenied";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage({ searchParams }) {
  const session = await requireTenantSession();
  if (!sessionCan(session, "suppliers:view")) return <AccessDenied />;
  const sp = await searchParams;
  const { ctx } = session;
  const data = await listSuppliers(ctx, { ...pageParams(sp), search: str(sp, "q"), owing: str(sp, "owing") });
  return (
    <>
      <PageHeader title="Suppliers" description="Who you buy from and how much you owe." actions={sessionCan(session, "suppliers:manage") ? <AddPartyButton kind="suppliers" currency={ctx.currency} disabled={!session.access.canWrite} /> : null} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Suppliers" value={data.summary.count} icon={Factory} />
        <StatCard label="You owe" value={formatMoney(data.summary.balance, ctx.currency)} icon={HandCoins} tone="red" href="/suppliers?owing=1" />
        <StatCard label="Total purchased" value={formatMoney(data.summary.purchases, ctx.currency)} tone="blue" />
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput placeholder="Name, company or phone…" />
        <FilterSelect param="owing" placeholder="Any balance" options={[{ value: "1", label: "Money owed" }]} />
      </div>
      {data.items.length ? (
        <TableCard footer={<Pagination page={data.page} pages={data.pages} total={data.total} basePath="/suppliers" searchParams={sp} label="suppliers" />}>
          <table className="table-base">
            <thead>
              <tr>
                <th>Supplier</th>
                <th className="hidden sm:table-cell">Phone</th>
                <th className="hidden text-right md:table-cell">Purchased</th>
                <th className="text-right">You owe</th>
                <th className="hidden lg:table-cell">Last purchase</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={String(s._id)}>
                  <td>
                    <Link href={`/suppliers/${s._id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {s.name}
                    </Link>
                    {s.company ? <p className="text-xs text-slate-500">{s.company}</p> : null}
                  </td>
                  <td className="hidden text-slate-600 sm:table-cell">{s.phone || "—"}</td>
                  <td className="hidden text-right tabular-nums md:table-cell">{formatMoney(s.totalPurchases, ctx.currency)}</td>
                  <td className="text-right">{s.balance > 0 ? <Badge tone="red">{formatMoney(s.balance, ctx.currency)}</Badge> : <span className="text-slate-400">—</span>}</td>
                  <td className="hidden text-slate-500 lg:table-cell">{s.lastPurchaseAt ? formatDate(s.lastPurchaseAt) : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState icon={Factory} title="No suppliers found" description="Add suppliers to link products and track what you owe them." />
        </div>
      )}
    </>
  );
}
