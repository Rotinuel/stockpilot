import Link from "next/link";
import { Users, HandCoins } from "lucide-react";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { listCustomers } from "@/services/customers";
import { pageParams, str } from "@/lib/query";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/utils/format";
import { PageHeader, EmptyState, TableCard, StatCard } from "@/components/ui/Misc";
import Badge from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";
import { SearchInput, FilterSelect } from "@/components/ui/UrlFilters";
import { AddPartyButton } from "@/components/parties/PartyForms";
import AccessDenied from "@/components/layout/AccessDenied";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }) {
  const session = await requireTenantSession();
  if (!sessionCan(session, "customers:view")) return <AccessDenied />;
  const sp = await searchParams;
  const { ctx } = session;
  const data = await listCustomers(ctx, { ...pageParams(sp), search: str(sp, "q"), type: str(sp, "type"), owing: str(sp, "owing"), sort: str(sp, "sort") });

  return (
    <>
      <PageHeader title="Customers" description="Purchase history and outstanding balances." actions={sessionCan(session, "customers:create") ? <AddPartyButton kind="customers" currency={ctx.currency} disabled={!session.access.canWrite} /> : null} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Customers" value={data.summary.count} icon={Users} />
        <StatCard label="Outstanding balances" value={formatMoney(data.summary.balance, ctx.currency)} icon={HandCoins} tone="yellow" href="/customers?owing=1" />
        <StatCard label="Lifetime purchases" value={formatMoney(data.summary.purchases, ctx.currency)} tone="green" />
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput placeholder="Name, phone or email…" />
        <FilterSelect param="type" placeholder="All types" options={[{ value: "cash", label: "Cash customers" }, { value: "credit", label: "Credit customers" }]} />
        <FilterSelect param="owing" placeholder="Any balance" options={[{ value: "1", label: "Owing money" }]} />
        <FilterSelect param="sort" placeholder="Name A–Z" options={[{ value: "balance", label: "Highest balance" }, { value: "purchases", label: "Top buyers" }, { value: "recent", label: "Recently active" }, { value: "newest", label: "Newest" }]} />
      </div>
      {data.items.length ? (
        <TableCard footer={<Pagination page={data.page} pages={data.pages} total={data.total} basePath="/customers" searchParams={sp} label="customers" />}>
          <table className="table-base">
            <thead>
              <tr>
                <th>Customer</th>
                <th className="hidden sm:table-cell">Type</th>
                <th className="hidden text-right md:table-cell">Purchases</th>
                <th className="text-right">Balance</th>
                <th className="hidden lg:table-cell">Last purchase</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={String(c._id)}>
                  <td>
                    <Link href={`/customers/${c._id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {c.name}
                    </Link>
                    <p className="text-xs text-slate-500">{c.phone || c.email || "—"}</p>
                  </td>
                  <td className="hidden sm:table-cell">
                    <Badge tone={c.type === "credit" ? "purple" : "gray"}>{c.type}</Badge>
                  </td>
                  <td className="hidden text-right tabular-nums md:table-cell">{formatMoney(c.totalPurchases, ctx.currency)}</td>
                  <td className="text-right">{c.balance > 0 ? <Badge tone="yellow">{formatMoney(c.balance, ctx.currency)}</Badge> : <span className="text-slate-400">—</span>}</td>
                  <td className="hidden text-slate-500 lg:table-cell">{c.lastPurchaseAt ? formatDate(c.lastPurchaseAt) : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState icon={Users} title="No customers found" description="Add customers to track purchase history and credit balances." />
        </div>
      )}
    </>
  );
}
