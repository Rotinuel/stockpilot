import Link from "next/link";
import { Download, FileText, Lock, Banknote, Receipt, TrendingUp, Percent, Package, Boxes, TriangleAlert, Wallet, Users, HandCoins } from "lucide-react";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { REPORT_TYPES, reportAccess } from "@/lib/report-access";
import { hasFeature, featureMessage } from "@/lib/plans";
import { rangeFromSearch, str } from "@/lib/query";
import { salesSummary, salesByDay, salesByPaymentMethod, topProducts, inventoryReport, profitReport, expensesSummary, customerReport } from "@/services/reports";
import { toPlain } from "@/lib/serialize";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/utils/format";
import { PAYMENT_METHOD_LABELS, EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import { RANGE_PRESETS } from "@/utils/dates";
import { PageHeader, StatCard, TableCard, EmptyState } from "@/components/ui/Misc";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import LinkTabs from "@/components/ui/LinkTabs";
import { RangeFilter } from "@/components/ui/UrlFilters";
import TrendChart from "@/components/charts/TrendChart";
import BarList from "@/components/charts/BarList";
import DonutChart from "@/components/charts/DonutChart";
import ColumnChart from "@/components/charts/ColumnChart";
import { UpgradeCard } from "@/components/layout/Banners";
import AccessDenied from "@/components/layout/AccessDenied";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }) {
  const session = await requireTenantSession();
  if (!sessionCan(session, "reports:view")) return <AccessDenied />;
  const sp = await searchParams;
  const { ctx, user, tenant, plan } = session;
  const visible = REPORT_TYPES.filter((r) => reportAccess(user.role, tenant.settings, plan, r.key).reason !== "role");
  if (!visible.length) return <AccessDenied />;
  const requested = str(sp, "type");
  const type = visible.some((r) => r.key === requested) ? requested : visible[0].key;
  const access = reportAccess(user.role, tenant.settings, plan, type);
  const range = rangeFromSearch(sp, ctx.timezone, "this_month");
  const cur = ctx.currency;
  const canExport = hasFeature(plan, "export");
  const qs = new URLSearchParams({ type, range: range.preset, ...(range.preset === "custom" ? { from: str(sp, "from") || "", to: str(sp, "to") || "" } : {}) }).toString();

  const tabs = visible.map((r) => {
    const a = reportAccess(user.role, tenant.settings, plan, r.key);
    const params = new URLSearchParams({ type: r.key });
    if (str(sp, "range")) params.set("range", str(sp, "range"));
    if (str(sp, "from")) params.set("from", str(sp, "from"));
    if (str(sp, "to")) params.set("to", str(sp, "to"));
    return { key: r.key, label: r.label, href: `/reports?${params}`, icon: a.allowed ? null : Lock };
  });

  let body;
  if (!access.allowed) {
    body = <UpgradeCard title={`${REPORT_TYPES.find((r) => r.key === type)?.label} report is a paid feature`} message={featureMessage(access.feature)} />;
  } else if (type === "sales") {
    const [summary, daily, methods, top] = await Promise.all([salesSummary(ctx, range), salesByDay(ctx, range), salesByPaymentMethod(ctx, range), topProducts(ctx, range, 10)]);
    body = (
      <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total sales" value={formatMoney(summary.totalSales, cur)} hint="Incl. tax" icon={Banknote} />
          <StatCard label="Transactions" value={summary.count} hint={`Avg ${formatMoney(summary.averageSale, cur)} · ${summary.cancelled} cancelled`} icon={Receipt} tone="blue" />
          <StatCard label="Revenue" value={formatMoney(summary.revenue, cur)} hint={`Discounts ${formatMoney(summary.discounts, cur)}`} icon={TrendingUp} tone="purple" />
          <StatCard label="Gross profit" value={formatMoney(summary.grossProfit, cur)} hint={`Tax collected ${formatMoney(summary.tax, cur)}`} icon={Percent} tone="green" />
        </div>
        <Card className="mt-6">
          <CardHeader title="Daily sales" description={range.label} />
          <CardBody>
            <TrendChart data={toPlain(daily)} series={[{ key: "revenue", label: "Revenue" }, { key: "profit", label: "Gross profit" }]} currency={cur} />
          </CardBody>
        </Card>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Top products" description="By line revenue" />
            <CardBody>{top.length ? <BarList items={top.map((t) => ({ key: t.productId, label: `${t.name} (${t.quantity})`, value: t.revenue }))} currency={cur} /> : <p className="py-6 text-center text-sm text-slate-500">No sales in this period.</p>}</CardBody>
          </Card>
          <Card>
            <CardHeader title="Payment methods" />
            <CardBody>
              <DonutChart items={methods.map((m) => ({ label: `${PAYMENT_METHOD_LABELS[m.method] || m.method} (${m.count})`, value: m.total }))} currency={cur} />
            </CardBody>
          </Card>
        </div>
        <p className="mt-4 text-sm">
          <Link href={`/sales?range=${range.preset === "custom" ? "this_month" : range.preset}`} className="font-medium text-brand-600 hover:text-brand-700">
            View individual transactions →
          </Link>
        </p>
      </>
    );
  } else if (type === "inventory") {
    const r = await inventoryReport(ctx);
    const canCost = sessionCan(session, "products:view_cost");
    body = (
      <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Products" value={r.totalProducts} hint={`${r.activeProducts} active`} icon={Package} />
          <StatCard label="Total stock quantity" value={r.totalQuantity.toLocaleString("en-NG")} icon={Boxes} tone="blue" />
          <StatCard label="Low stock" value={r.lowStockCount} hint={`${r.outOfStockCount} out of stock`} icon={TriangleAlert} tone="yellow" href="/inventory/low-stock" />
          {canCost ? <StatCard label="Inventory value" value={formatMoney(r.inventoryValue, cur)} hint={`Retail ${formatMoney(r.retailValue, cur)}`} icon={Wallet} tone="green" /> : null}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <TableCard>
            <div className="border-b border-slate-100 px-5 py-4 text-sm font-semibold">Stock by category</div>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="text-right">Products</th>
                  <th className="text-right">Qty</th>
                  {canCost ? <th className="text-right">Value</th> : null}
                </tr>
              </thead>
              <tbody>
                {r.byCategory.map((c) => (
                  <tr key={c.category}>
                    <td>{c.category}</td>
                    <td className="text-right tabular-nums">{c.products}</td>
                    <td className="text-right tabular-nums">{c.quantity}</td>
                    {canCost ? <td className="text-right tabular-nums">{formatMoney(c.costValue, cur)}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
          <TableCard>
            <div className="border-b border-slate-100 px-5 py-4 text-sm font-semibold">Low & out-of-stock</div>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Min</th>
                </tr>
              </thead>
              <tbody>
                {r.lowStock.length ? (
                  r.lowStock.map((p) => (
                    <tr key={String(p._id)}>
                      <td>
                        <Link href={`/products/${p._id}`} className="hover:text-brand-700">
                          {p.name}
                        </Link>
                      </td>
                      <td className="text-right">
                        <Badge tone={p.quantity <= 0 ? "red" : "yellow"}>{p.quantity}</Badge>
                      </td>
                      <td className="text-right tabular-nums">{p.minimumStockLevel}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-slate-500">
                      Nothing low.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableCard>
        </div>
      </>
    );
  } else if (type === "profit") {
    const r = await profitReport(ctx, range);
    body = (
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Profit & loss" description={range.label} />
          <CardBody className="space-y-3 text-sm">
            {[
              ["Revenue (sales excl. tax)", r.revenue],
              ["Cost of goods sold", -r.cogs],
              ["Gross profit", r.grossProfit, true, `${r.grossMargin}% margin`],
              ["Operating expenses", -r.expenses],
              ["Net profit", r.netProfit, true, `${r.netMargin}% margin`],
            ].map(([label, value, strong, note]) => (
              <div key={label} className={strong ? "border-t border-slate-100 pt-3" : ""}>
                <div className={`flex justify-between ${strong ? "font-semibold text-slate-900" : "text-slate-600"}`}>
                  <span>{label}</span>
                  <span className={`tabular-nums ${strong && value < 0 ? "text-rose-600" : ""}`}>{formatMoney(value, cur)}</span>
                </div>
                {note ? <p className="text-right text-xs text-slate-500">{note}</p> : null}
              </div>
            ))}
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              <strong className="text-slate-700">Gross profit</strong> = Revenue − Cost of goods sold. <strong className="text-slate-700">Net profit</strong> = Gross profit − Expenses. Discounts: {formatMoney(r.discounts, cur)}; tax collected (not revenue): {formatMoney(r.tax, cur)}.
            </div>
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Gross vs net profit" description="Daily" />
          <CardBody>
            <TrendChart data={toPlain(r.daily)} series={[{ key: "grossProfit", label: "Gross profit" }, { key: "netProfit", label: "Net profit" }]} currency={cur} />
          </CardBody>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="Expenses by category" />
          <CardBody>
            <DonutChart items={r.expensesByCategory.map((c) => ({ label: EXPENSE_CATEGORY_LABELS[c.category] || c.category, value: c.total }))} currency={cur} />
          </CardBody>
        </Card>
      </div>
    );
  } else if (type === "expenses") {
    const r = await expensesSummary(ctx, range);
    body = (
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <StatCard label="Total expenses" value={formatMoney(r.total, cur)} hint={`${r.count} entries`} icon={Wallet} tone="red" />
          <Card>
            <CardHeader title="By category" />
            <CardBody>
              <DonutChart items={r.byCategory.map((c) => ({ label: EXPENSE_CATEGORY_LABELS[c.category] || c.category, value: c.total }))} currency={cur} />
            </CardBody>
          </Card>
        </div>
        <Card className="lg:col-span-2">
          <CardHeader title="Expenses by day" description={range.label} />
          <CardBody>
            <ColumnChart data={r.byDay.map((d) => ({ label: formatDate(`${d.date}T12:00:00Z`, { day: "numeric", month: "short", year: undefined }), value: d.total }))} money currency={cur} />
          </CardBody>
        </Card>
      </div>
    );
  } else if (type === "customers") {
    const r = toPlain(await customerReport(ctx, range));
    body = (
      <>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Customers" value={r.totalCustomers} hint={`${r.newCustomers} new in period`} icon={Users} />
          <StatCard label="Outstanding balances" value={formatMoney(r.outstanding, cur)} icon={HandCoins} tone="yellow" />
          <StatCard label="Lifetime purchases" value={formatMoney(r.lifetimePurchases, cur)} tone="green" />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <TableCard>
            <div className="border-b border-slate-100 px-5 py-4 text-sm font-semibold">Top customers · {range.label}</div>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="text-right">Sales</th>
                  <th className="text-right">Spent</th>
                </tr>
              </thead>
              <tbody>
                {r.topCustomers.length ? (
                  r.topCustomers.map((c) => (
                    <tr key={c.customerId}>
                      <td>
                        <Link href={`/customers/${c.customerId}`} className="hover:text-brand-700">
                          {c.name}
                        </Link>
                      </td>
                      <td className="text-right tabular-nums">{c.count}</td>
                      <td className="text-right tabular-nums">{formatMoney(c.total, cur)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-slate-500">
                      No named-customer sales in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableCard>
          <TableCard>
            <div className="border-b border-slate-100 px-5 py-4 text-sm font-semibold">Outstanding balances</div>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="text-right">Owes</th>
                  <th className="hidden text-right sm:table-cell">Last purchase</th>
                </tr>
              </thead>
              <tbody>
                {r.debtors.length ? (
                  r.debtors.map((c) => (
                    <tr key={c._id}>
                      <td>
                        <Link href={`/customers/${c._id}`} className="hover:text-brand-700">
                          {c.name}
                        </Link>
                      </td>
                      <td className="text-right font-medium tabular-nums">{formatMoney(c.balance, cur)}</td>
                      <td className="hidden text-right text-slate-500 sm:table-cell">{c.lastPurchaseAt ? formatDate(c.lastPurchaseAt) : "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-slate-500">
                      No outstanding balances.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableCard>
        </div>
      </>
    );
  } else {
    body = <EmptyState icon={FileText} title="Choose a report" />;
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Understand your sales, stock, profit, expenses and customers."
        actions={
          access.allowed ? (
            canExport ? (
              <>
                <Button variant="outline" icon={Download} href={`/api/reports/export?${qs}&format=csv`}>
                  CSV
                </Button>
                <Button variant="outline" icon={FileText} href={`/api/reports/export?${qs}&format=pdf`}>
                  PDF
                </Button>
              </>
            ) : (
              <Button variant="outline" icon={Lock} href="/billing" title="Export is available on the Professional plan">
                Export
              </Button>
            )
          ) : null
        }
      />
      <LinkTabs tabs={tabs} active={type} className="mb-5" />
      {type !== "inventory" && access.allowed ? (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <RangeFilter presets={RANGE_PRESETS} />
          <span className="text-sm text-slate-500">{range.label}</span>
        </div>
      ) : null}
      {body}
    </>
  );
}
