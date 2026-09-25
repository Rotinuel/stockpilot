import Link from "next/link";
import { History, TriangleAlert, PackageCheck } from "lucide-react";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { listLowStock } from "@/services/stock";
import { pageParams, str } from "@/lib/query";
import { formatMoney } from "@/lib/money";
import { PageHeader, EmptyState, TableCard, Alert } from "@/components/ui/Misc";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import LinkTabs from "@/components/ui/LinkTabs";
import { SearchInput } from "@/components/ui/UrlFilters";
import AccessDenied from "@/components/layout/AccessDenied";

export const metadata = { title: "Low stock" };

export default async function LowStockPage({ searchParams }) {
  const session = await requireTenantSession();
  if (!sessionCan(session, "products:view")) return <AccessDenied />;
  const sp = await searchParams;
  const { ctx } = session;
  const data = await listLowStock(ctx, { ...pageParams(sp), search: str(sp, "q") });
  const canCost = sessionCan(session, "products:view_cost");

  return (
    <>
      <PageHeader
        title="Low stock"
        description="Products at or below their low-stock alert level."
        actions={sessionCan(session, "purchases:create") ? <Button href="/purchases/new">Record a purchase</Button> : null}
      />
      {sessionCan(session, "inventory:view") ? (
        <LinkTabs
          className="mb-5"
          active="low"
          tabs={[
            { key: "movements", label: "Stock movements", href: "/inventory", icon: History },
            { key: "low", label: "Low stock", href: "/inventory/low-stock", icon: TriangleAlert, badge: data.total || null },
          ]}
        />
      ) : null}
      {data.total ? (
        <Alert tone="warning" icon={TriangleAlert} className="mb-4">
          {data.total} product{data.total === 1 ? " is" : "s are"} running low{data.outOfStock ? `, including ${data.outOfStock} out of stock` : ""}.
        </Alert>
      ) : null}
      <div className="mb-4">
        <SearchInput placeholder="Search low-stock products…" />
      </div>
      {data.items.length ? (
        <TableCard footer={<Pagination page={data.page} pages={data.pages} total={data.total} basePath="/inventory/low-stock" searchParams={sp} label="products" />}>
          <table className="table-base">
            <thead>
              <tr>
                <th>Product</th>
                <th className="text-right">In stock</th>
                <th className="text-right">Alert level</th>
                <th className="hidden text-right sm:table-cell">Suggested reorder</th>
                {canCost ? <th className="hidden text-right md:table-cell">Est. cost</th> : null}
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => {
                const reorder = Math.max(p.minimumStockLevel * 2 - p.quantity, p.minimumStockLevel || 1);
                return (
                  <tr key={String(p._id)}>
                    <td>
                      <Link href={`/products/${p._id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {p.name}
                      </Link>
                      <p className="text-xs text-slate-500">{p.sku}</p>
                    </td>
                    <td className="text-right">
                      <Badge tone={p.quantity <= 0 ? "red" : "yellow"}>{p.quantity <= 0 ? "Out of stock" : `${p.quantity} ${p.unit}`}</Badge>
                    </td>
                    <td className="text-right text-slate-600 tabular-nums">{p.minimumStockLevel}</td>
                    <td className="hidden text-right font-medium tabular-nums sm:table-cell">
                      {reorder} {p.unit}
                    </td>
                    {canCost ? <td className="hidden text-right text-slate-600 tabular-nums md:table-cell">{formatMoney(reorder * p.costPrice, ctx.currency)}</td> : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableCard>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState icon={PackageCheck} title="No low-stock products" description="Every product is above its alert level. Nice work!" />
        </div>
      )}
    </>
  );
}
