import { notFound } from "next/navigation";
import { Boxes, History, MapPin } from "lucide-react";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { getProduct } from "@/services/products";
import { listCategories } from "@/services/products";
import { allSuppliersLite } from "@/services/suppliers";
import { listLocations } from "@/services/locations";
import { toPlain } from "@/lib/serialize";
import { formatMoney, marginPercent } from "@/lib/money";
import { formatDateTime } from "@/utils/format";
import { MOVEMENT_TYPE_LABELS } from "@/lib/constants";
import { PageHeader, StatCard, KeyValue } from "@/components/ui/Misc";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ProductDetailActions from "@/components/products/ProductDetailActions";
import { ProductPhotoCard } from "@/components/products/ProductPhoto";
import AccessDenied from "@/components/layout/AccessDenied";

export const metadata = { title: "Product details" };

export default async function ProductDetailPage({ params }) {
  const session = await requireTenantSession();
  if (!sessionCan(session, "products:view")) return <AccessDenied />;
  const { id } = await params;
  const { ctx } = session;
  let data;
  try {
    data = await getProduct(ctx, id);
  } catch {
    notFound();
  }
  const { product, category, supplier, locations, movements } = data;
  const canCost = sessionCan(session, "products:view_cost");
  const [cats, sups, locs] = await Promise.all([
    sessionCan(session, "products:update") ? listCategories(ctx) : [],
    sessionCan(session, "products:update") ? allSuppliersLite(ctx) : [],
    listLocations(ctx, { activeOnly: true }),
  ]);
  const low = product.quantity <= product.minimumStockLevel;

  return (
    <>
      <PageHeader
        back={{ href: "/products", label: "Products" }}
        title={product.name}
        description={`${product.sku}${product.barcode ? ` · Barcode ${product.barcode}` : ""}`}
        actions={
          <ProductDetailActions
            product={toPlain(product)}
            categories={toPlain(cats)}
            suppliers={toPlain(sups)}
            locations={toPlain(locs)}
            currency={ctx.currency}
            canUpdate={sessionCan(session, "products:update")}
            canAdjust={sessionCan(session, "inventory:adjust")}
            canWrite={session.access.canWrite}
          />
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="In stock" value={`${product.quantity} ${product.unit}`} hint={`Alert at ${product.minimumStockLevel}`} icon={Boxes} tone={product.quantity <= 0 ? "red" : low ? "yellow" : "green"} />
        <StatCard label="Selling price" value={formatMoney(product.sellingPrice, ctx.currency)} hint={`per ${product.unit}`} />
        {canCost ? <StatCard label="Cost price" value={formatMoney(product.costPrice, ctx.currency)} hint={`Margin ${marginPercent(product.sellingPrice, product.costPrice)}%`} /> : null}
        {canCost ? <StatCard label="Stock value (cost)" value={formatMoney(Math.max(product.quantity, 0) * product.costPrice, ctx.currency)} hint={`Retail ${formatMoney(Math.max(product.quantity, 0) * product.sellingPrice, ctx.currency)}`} /> : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Details" />
          <CardBody className="divide-y divide-slate-100 py-2">
            <KeyValue label="Status" value={<Badge tone={product.status === "active" ? "green" : "gray"}>{product.status}</Badge>} />
            <KeyValue label="Category" value={category?.name || "—"} />
            <KeyValue label="Brand" value={product.brand || "—"} />
            <KeyValue label="Unit" value={product.unit} />
            <KeyValue label="Supplier" value={supplier ? supplier.name : "—"} />
            <KeyValue label="Added" value={formatDateTime(product.createdAt)} />
            {product.description ? <p className="pt-3 text-sm text-slate-600">{product.description}</p> : null}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Stock by location" icon={MapPin} />
          <ul className="divide-y divide-slate-100">
            {locations.map((l) => (
              <li key={l.locationId} className="flex items-center justify-between px-5 py-3 text-sm">
                <span>
                  {l.name} {l.isDefault ? <Badge tone="brand" className="ml-1">Default</Badge> : null}
                </span>
                <span className="font-semibold tabular-nums">
                  {l.quantity} {product.unit}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="overflow-hidden">
          <ProductPhotoCard productId={String(product._id)} image={product.image || ""} name={product.name} canEdit={sessionCan(session, "products:update") && session.access.canWrite} />
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Stock history" description="Every change to this product's stock" icon={History} action={sessionCan(session, "inventory:view") ? <Button href={`/inventory?product=${product._id}`} variant="ghost" size="sm">Full history</Button> : null} />
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th className="text-right">Change</th>
                <th className="text-right">Balance</th>
                <th className="hidden md:table-cell">Reason</th>
                <th className="hidden lg:table-cell">By</th>
              </tr>
            </thead>
            <tbody>
              {movements.length ? (
                movements.map((m) => (
                  <tr key={String(m._id)}>
                    <td className="whitespace-nowrap text-slate-600">{formatDateTime(m.createdAt, { timeZone: ctx.timezone })}</td>
                    <td>
                      <Badge tone={m.quantity >= 0 ? "green" : "red"}>{MOVEMENT_TYPE_LABELS[m.type]}</Badge>
                    </td>
                    <td className={`text-right font-medium tabular-nums ${m.quantity >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {m.quantity > 0 ? "+" : ""}
                      {m.quantity}
                    </td>
                    <td className="text-right tabular-nums">{m.newQuantity}</td>
                    <td className="hidden max-w-64 truncate text-slate-600 md:table-cell">{m.reason}</td>
                    <td className="hidden text-slate-500 lg:table-cell">{m.performedByName}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No stock movements yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
