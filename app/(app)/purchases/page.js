import Link from "next/link";
import { Truck, Plus } from "lucide-react";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { listPurchases } from "@/services/purchases";
import { allSuppliersLite } from "@/services/suppliers";
import { pageParams, str, optionalDateRange } from "@/lib/query";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/utils/format";
import { RANGE_PRESETS } from "@/utils/dates";
import { PageHeader, EmptyState, TableCard, StatCard } from "@/components/ui/Misc";
import Badge, { STATUS_TONES } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import { SearchInput, FilterSelect } from "@/components/ui/UrlFilters";
import AccessDenied from "@/components/layout/AccessDenied";

export const metadata = { title: "Purchases" };

export default async function PurchasesPage({ searchParams }) {
  const session = await requireTenantSession();
  if (!sessionCan(session, "purchases:view")) return <AccessDenied />;
  const sp = await searchParams;
  const { ctx } = session;
  const [data, suppliers] = await Promise.all([
    listPurchases(ctx, {
      ...pageParams(sp),
      ...optionalDateRange(sp, ctx.timezone),
      search: str(sp, "q"),
      supplierId: str(sp, "supplier"),
      paymentStatus: str(sp, "payment"),
      status: str(sp, "status"),
    }),
    allSuppliersLite(ctx),
  ]);

  return (
    <>
      <PageHeader
        title="Purchases"
        description="Stock received from suppliers."
        actions={sessionCan(session, "purchases:create") ? <Button href="/purchases/new" icon={Plus} disabled={!session.access.canWrite}>Record purchase</Button> : null}
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <StatCard label="Purchases in view" value={formatMoney(data.summary.total, ctx.currency)} hint={`${data.total} records`} icon={Truck} />
        <StatCard label="Unpaid to suppliers" value={formatMoney(data.summary.balance, ctx.currency)} tone="red" />
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput placeholder="PO #, invoice # or supplier…" />
        <FilterSelect param="supplier" placeholder="All suppliers" options={suppliers.map((s) => ({ value: String(s._id), label: s.name }))} />
        <FilterSelect param="range" placeholder="All time" options={RANGE_PRESETS.filter((r) => r.value !== "custom")} />
        <FilterSelect param="payment" placeholder="Any payment status" options={[{ value: "paid", label: "Paid" }, { value: "partial", label: "Part-paid" }, { value: "unpaid", label: "Unpaid" }]} />
      </div>
      {data.items.length ? (
        <TableCard footer={<Pagination page={data.page} pages={data.pages} total={data.total} basePath="/purchases" searchParams={sp} label="purchases" />}>
          <table className="table-base">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Supplier</th>
                <th className="hidden sm:table-cell">Date</th>
                <th className="text-right">Total</th>
                <th className="hidden text-right md:table-cell">Balance</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={String(p._id)} className={p.status === "cancelled" ? "opacity-60" : ""}>
                  <td>
                    <Link href={`/purchases/${p._id}`} className="font-medium text-brand-700 hover:underline">
                      {p.referenceNumber}
                    </Link>
                    {p.invoiceNumber ? <p className="text-xs text-slate-500">Inv. {p.invoiceNumber}</p> : null}
                  </td>
                  <td className="max-w-44 truncate text-slate-700">{p.supplierName}</td>
                  <td className="hidden text-slate-600 sm:table-cell">{formatDate(p.purchaseDate)}</td>
                  <td className="text-right font-medium tabular-nums">{formatMoney(p.total, ctx.currency)}</td>
                  <td className="hidden text-right tabular-nums md:table-cell">{formatMoney(p.balance, ctx.currency)}</td>
                  <td>{p.status === "cancelled" ? <Badge tone="red">Cancelled</Badge> : <Badge tone={STATUS_TONES[p.paymentStatus]}>{p.paymentStatus}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState icon={Truck} title="No purchases recorded" description="Record deliveries from suppliers to increase stock and track what you owe." action={sessionCan(session, "purchases:create") ? <Button href="/purchases/new">Record purchase</Button> : null} />
        </div>
      )}
    </>
  );
}
