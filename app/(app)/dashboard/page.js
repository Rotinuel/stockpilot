import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Banknote,
  TrendingUp,
  Package,
  TriangleAlert,
  Users,
  Factory,
  HandCoins,
  Wallet,
  ShoppingCart,
  Plus,
  Truck,
  Receipt,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { dashboardData, salesSummary } from "@/services/reports";
import { listLowStock } from "@/services/stock";
import { resolveRange } from "@/utils/dates";
import { formatMoney } from "@/lib/money";
import { formatDateTime, formatDate } from "@/utils/format";
import { PAYMENT_METHOD_LABELS, EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import { toPlain } from "@/lib/serialize";
import { PageHeader, StatCard, EmptyState } from "@/components/ui/Misc";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Badge, { STATUS_TONES } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import TrendChart from "@/components/charts/TrendChart";
import BarList from "@/components/charts/BarList";
import DonutChart from "@/components/charts/DonutChart";

export const metadata = { title: "Dashboard" };

function greeting() {
  const h = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Lagos" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage() {
  const session = await requireTenantSession();
  const { ctx, tenant, user, access } = session;
  if (!tenant.onboarding?.completed && user.role === "owner") redirect("/onboarding");
  const cur = ctx.currency;
  const firstName = user.name.split(" ")[0];

  const expiredBlock =
    !access.canWrite && sessionCan(session, "billing:view") ? (
      <Card className="mb-6 overflow-hidden">
        <div className="flex flex-col gap-4 bg-linear-to-r from-brand-950 to-brand-700 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-brand-200">
              <Sparkles className="h-4 w-4" /> Subscription required
            </p>
            <h2 className="mt-1 text-xl font-semibold">Keep your shop running with StockPilot</h2>
            <p className="mt-1 max-w-xl text-sm text-brand-100">All your products, sales and customers are saved. Choose a plan to continue recording sales and stock movements.</p>
          </div>
          <Button href="/billing" variant="outline" size="lg" className="border-white bg-white text-brand-700 hover:bg-brand-50">
            Choose a plan
          </Button>
        </div>
      </Card>
    ) : null;

  // Staff without access to financials get an operational dashboard.
  if (!sessionCan(session, "dashboard:financials")) {
    const today = resolveRange("today", { tz: ctx.timezone });
    const [mine, low] = await Promise.all([
      sessionCan(session, "sales:view") ? salesSummary({ ...ctx }, today) : null,
      sessionCan(session, "inventory:view") ? listLowStock(ctx, { limit: 8 }) : null,
    ]);
    return (
      <>
        <PageHeader title={`${greeting()}, ${firstName}`} description={`Here's what's happening at ${tenant.businessName} today.`} />
        {expiredBlock}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessionCan(session, "pos:use") ? (
            <Link href="/pos" className="flex items-center gap-4 rounded-xl bg-brand-600 p-5 text-white shadow-card hover:bg-brand-700">
              <ShoppingCart className="h-8 w-8" />
              <span>
                <span className="block text-lg font-semibold">Open POS</span>
                <span className="text-sm text-brand-100">Start a new sale</span>
              </span>
            </Link>
          ) : null}
          {mine ? <StatCard label="Sales today" value={formatMoney(mine.totalSales, cur)} hint={`${mine.count} transactions`} icon={Banknote} /> : null}
          {low ? <StatCard label="Low-stock products" value={low.total} hint={`${low.outOfStock} out of stock`} icon={TriangleAlert} tone="yellow" href="/inventory/low-stock" /> : null}
        </div>
        {low?.items?.length ? (
          <Card className="mt-6">
            <CardHeader title="Running low" description="Restock these products soon" icon={TriangleAlert} action={<Button href="/inventory/low-stock" variant="ghost" size="sm">View all</Button>} />
            <ul className="divide-y divide-slate-100">
              {low.items.map((p) => (
                <li key={String(p._id)} className="flex items-center justify-between px-5 py-3 text-sm">
                  <Link href={`/products/${p._id}`} className="font-medium text-slate-800 hover:text-brand-700">
                    {p.name}
                  </Link>
                  <Badge tone={p.quantity <= 0 ? "red" : "yellow"}>
                    {p.quantity} {p.unit} left
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </>
    );
  }

  const data = await dashboardData(ctx);
  const low = await listLowStock(ctx, { limit: 6 });
  const hasSales = data.trend.some((d) => d.revenue > 0);

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={`Here's how ${tenant.businessName} is doing.`}
        actions={
          <>
            {sessionCan(session, "products:create") ? (
              <Button href="/products?new=1" variant="outline" icon={Plus}>
                Add product
              </Button>
            ) : null}
            {sessionCan(session, "pos:use") ? (
              <Button href="/pos" icon={ShoppingCart}>
                New sale
              </Button>
            ) : null}
          </>
        }
      />
      {expiredBlock}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today's sales" value={formatMoney(data.today.totalSales, cur)} hint={`${data.today.count} transaction${data.today.count === 1 ? "" : "s"}`} icon={Banknote} href="/sales?range=today" />
        <StatCard label="Today's gross profit" value={formatMoney(data.today.grossProfit, cur)} hint={`Revenue ${formatMoney(data.today.revenue, cur)}`} icon={TrendingUp} tone="green" />
        <StatCard label="Monthly sales" value={formatMoney(data.month.totalSales, cur)} hint={`${data.month.count} transactions this month`} icon={CalendarDays} tone="blue" href="/reports?type=sales" />
        <StatCard
          label="Monthly net profit"
          value={formatMoney(data.month.netProfit, cur)}
          hint={`Gross ${formatMoney(data.month.grossProfit, cur)} − expenses ${formatMoney(data.month.expenses, cur)}`}
          icon={Wallet}
          tone={data.month.netProfit >= 0 ? "green" : "red"}
          href="/reports?type=profit"
        />
        <StatCard label="Products" value={data.counts.products.toLocaleString("en-NG")} hint="In your catalogue" icon={Package} tone="purple" href="/products" />
        <StatCard label="Low stock" value={data.counts.lowStock} hint={data.counts.lowStock ? `${data.counts.lowStock} product${data.counts.lowStock === 1 ? " is" : "s are"} running low` : "All stock levels healthy"} icon={TriangleAlert} tone={data.counts.lowStock ? "yellow" : "gray"} href="/inventory/low-stock" />
        <StatCard label="Customers owe you" value={formatMoney(data.balances.customers, cur)} hint={`${data.counts.customers} customers`} icon={HandCoins} tone="blue" href="/customers?owing=1" />
        <StatCard label="You owe suppliers" value={formatMoney(data.balances.suppliers, cur)} hint={`${data.counts.suppliers} suppliers`} icon={Factory} tone="red" href="/suppliers?owing=1" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Sales & gross profit" description="Last 30 days" />
          <CardBody>
            {hasSales ? (
              <TrendChart data={toPlain(data.trend)} series={[{ key: "revenue", label: "Revenue" }, { key: "profit", label: "Gross profit" }]} currency={cur} />
            ) : (
              <EmptyState icon={Receipt} title="No sales yet" description="Record your first sale in the POS and your chart will appear here." action={sessionCan(session, "pos:use") ? <Button href="/pos">Open POS</Button> : null} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="This month at a glance" description="Gross vs net profit" />
          <CardBody className="space-y-3 text-sm">
            {[
              ["Revenue (excl. tax)", data.month.revenue],
              ["Cost of goods sold", -data.month.cogs],
              ["Gross profit", data.month.grossProfit, true],
              ["Expenses", -data.month.expenses],
              ["Net profit", data.month.netProfit, true],
            ].map(([label, value, strong]) => (
              <div key={label} className={`flex items-center justify-between ${strong ? "border-t border-slate-100 pt-3 font-semibold text-slate-900" : "text-slate-600"}`}>
                <span>{label}</span>
                <span className={`tabular-nums ${strong && value < 0 ? "text-rose-600" : ""}`}>{formatMoney(value, cur)}</span>
              </div>
            ))}
            <p className="pt-2 text-xs text-slate-500">Gross profit = revenue − cost of goods. Net profit also subtracts your expenses.</p>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Top-selling products" description="This month, by revenue" />
          <CardBody>
            {data.topProducts.length ? (
              <BarList items={toPlain(data.topProducts.map((p) => ({ key: p.productId, label: p.name, value: p.revenue, quantity: p.quantity })))} currency={cur} />
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">No sales this month yet.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Sales by payment method" description="This month" />
          <CardBody>
            <DonutChart items={data.paymentMethods.map((m) => ({ label: PAYMENT_METHOD_LABELS[m.method] || m.method, value: m.total }))} currency={cur} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Expenses by category" description="This month" action={sessionCan(session, "expenses:view") ? <Button href="/expenses" variant="ghost" size="sm">View</Button> : null} />
          <CardBody>
            <DonutChart items={data.expensesByCategory.map((c) => ({ label: EXPENSE_CATEGORY_LABELS[c.category] || c.category, value: c.total }))} currency={cur} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Recent sales" action={<Button href="/sales" variant="ghost" size="sm">View all</Button>} />
          {data.recentSales.length ? (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th className="hidden sm:table-cell">Method</th>
                    <th className="text-right">Total</th>
                    <th className="hidden md:table-cell">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentSales.map((s) => (
                    <tr key={String(s._id)}>
                      <td>
                        <Link href={`/sales/${s._id}`} className="font-medium text-brand-700 hover:underline">
                          {s.invoiceNumber}
                        </Link>
                        {s.status === "cancelled" ? <Badge tone="red" className="ml-2">Cancelled</Badge> : null}
                      </td>
                      <td className="max-w-40 truncate text-slate-600">{s.customerName}</td>
                      <td className="hidden text-slate-600 sm:table-cell">{PAYMENT_METHOD_LABELS[s.paymentMethod]}</td>
                      <td className="text-right font-medium tabular-nums">{formatMoney(s.total, cur)}</td>
                      <td className="hidden text-slate-500 md:table-cell">{formatDateTime(s.createdAt, { timeZone: ctx.timezone })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Receipt} title="No sales recorded yet" />
          )}
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Low-stock products" icon={TriangleAlert} action={<Button href="/inventory/low-stock" variant="ghost" size="sm">All</Button>} />
            {low.items.length ? (
              <ul className="divide-y divide-slate-100">
                {low.items.map((p) => (
                  <li key={String(p._id)} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <Link href={`/products/${p._id}`} className="truncate text-slate-700 hover:text-brand-700">
                      {p.name}
                    </Link>
                    <Badge tone={p.quantity <= 0 ? "red" : "yellow"}>{p.quantity <= 0 ? "Out of stock" : `${p.quantity} left`}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-center text-sm text-slate-500">Stock levels look healthy.</p>
            )}
          </Card>
          <Card>
            <CardHeader title="Recent purchases" icon={Truck} action={sessionCan(session, "purchases:view") ? <Button href="/purchases" variant="ghost" size="sm">All</Button> : null} />
            {data.recentPurchases.length ? (
              <ul className="divide-y divide-slate-100">
                {data.recentPurchases.map((p) => (
                  <li key={String(p._id)} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link href={`/purchases/${p._id}`} className="font-medium text-slate-800 hover:text-brand-700">
                        {p.referenceNumber}
                      </Link>
                      <p className="truncate text-xs text-slate-500">
                        {p.supplierName} · {formatDate(p.purchaseDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium tabular-nums">{formatMoney(p.total, cur)}</p>
                      <Badge tone={STATUS_TONES[p.paymentStatus]}>{p.paymentStatus}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-center text-sm text-slate-500">No purchases recorded yet.</p>
            )}
          </Card>
          <Card>
            <CardHeader title="Customers & suppliers" icon={Users} />
            <CardBody className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Customers</p>
                <p className="text-lg font-semibold">{data.counts.customers}</p>
              </div>
              <div>
                <p className="text-slate-500">Suppliers</p>
                <p className="text-lg font-semibold">{data.counts.suppliers}</p>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
