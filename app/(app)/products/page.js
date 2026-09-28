import Link from "next/link";
import { Package } from "lucide-react";
import { requireTenantSession, sessionCan } from "@/lib/session";
import { listProducts, listCategories } from "@/services/products";
import { allSuppliersLite } from "@/services/suppliers";
import { listLocations } from "@/services/locations";
import { pageParams, str } from "@/lib/query";
import { toPlain } from "@/lib/serialize";
import { formatMoney } from "@/lib/money";
import { PageHeader, EmptyState, TableCard } from "@/components/ui/Misc";
import Badge from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";
import { SearchInput, FilterSelect } from "@/components/ui/UrlFilters";
import ProductsToolbar from "@/components/products/ProductsToolbar";
import ProductRowActions from "@/components/products/ProductRowActions";
import { ProductThumb } from "@/components/products/ProductPhoto";
import AccessDenied from "@/components/layout/AccessDenied";

export const metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }) {
  const session = await requireTenantSession();
  if (!sessionCan(session, "products:view")) return <AccessDenied />;
  const sp = await searchParams;
  const { ctx } = session;
  const canCost = sessionCan(session, "products:view_cost");
  const canManage = sessionCan(session, "products:create");

  const [data, categories, suppliers, locations] = await Promise.all([
    listProducts(ctx, {
      ...pageParams(sp),
      search: str(sp, "q"),
      categoryId: str(sp, "category"),
      status: str(sp, "status"),
      stock: str(sp, "stock"),
      supplierId: str(sp, "supplier"),
      sort: str(sp, "sort"),
    }),
    listCategories(ctx),
    canManage ? allSuppliersLite(ctx) : [],
    sessionCan(session, "inventory:adjust") ? listLocations(ctx, { activeOnly: true }) : [],
  ]);
  const cats = toPlain(categories);
  const sups = toPlain(suppliers);
  const locs = toPlain(locations);
  const canWrite = session.access.canWrite;
  const canEditPhotos = canWrite && sessionCan(session, "products:update");
  const filtered = Boolean(str(sp, "q") || str(sp, "category") || str(sp, "status") || str(sp, "stock"));

  return (
    <>
      <PageHeader
        title="Products"
        description="Your catalogue, prices and stock levels."
        actions={
          <ProductsToolbar
            categories={cats}
            suppliers={sups}
            currency={ctx.currency}
            canCreate={canManage}
            canImport={sessionCan(session, "products:import")}
            canExport={sessionCan(session, "products:export")}
            canManageCategories={sessionCan(session, "categories:manage")}
            canWrite={canWrite}
          />
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput placeholder="Search name, SKU, barcode…" />
        <FilterSelect param="category" placeholder="All categories" options={cats.map((c) => ({ value: c._id, label: c.name }))} />
        <FilterSelect
          param="stock"
          placeholder="Any stock level"
          options={[
            { value: "low", label: "Low stock" },
            { value: "out", label: "Out of stock" },
            { value: "in", label: "In stock" },
          ]}
        />
        <FilterSelect param="status" placeholder="Any status" options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
        <FilterSelect
          param="sort"
          placeholder="Newest first"
          options={[
            { value: "name_asc", label: "Name A–Z" },
            { value: "name_desc", label: "Name Z–A" },
            { value: "price_desc", label: "Price high–low" },
            { value: "price_asc", label: "Price low–high" },
            { value: "qty_asc", label: "Stock low–high" },
            { value: "qty_desc", label: "Stock high–low" },
            { value: "oldest", label: "Oldest first" },
          ]}
        />
      </div>

      {data.items.length ? (
        <TableCard footer={<Pagination page={data.page} pages={data.pages} total={data.total} basePath="/products" searchParams={sp} label="products" />}>
          <table className="table-base">
            <thead>
              <tr>
                <th>Product</th>
                <th className="hidden md:table-cell">Category</th>
                <th className="text-right">Price</th>
                {canCost ? <th className="hidden text-right lg:table-cell">Cost</th> : null}
                <th className="text-right">Stock</th>
                <th className="hidden sm:table-cell">Status</th>
                <th className="w-10">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => {
                const low = p.quantity <= p.minimumStockLevel;
                return (
                  <tr key={String(p._id)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <ProductThumb productId={String(p._id)} image={p.image || ""} canEdit={canEditPhotos} />
                        <div className="min-w-0">
                          <Link href={`/products/${p._id}`} className="block max-w-56 truncate font-medium text-slate-900 hover:text-brand-700">
                            {p.name}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {p.sku}
                            {p.barcode ? ` · ${p.barcode}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden text-slate-600 md:table-cell">{p.categoryName || <span className="text-slate-400">—</span>}</td>
                    <td className="text-right font-medium tabular-nums">{formatMoney(p.sellingPrice, ctx.currency)}</td>
                    {canCost ? <td className="hidden text-right text-slate-600 tabular-nums lg:table-cell">{formatMoney(p.costPrice, ctx.currency)}</td> : null}
                    <td className="text-right">
                      <Badge tone={p.quantity <= 0 ? "red" : low ? "yellow" : "green"}>
                        {p.quantity} {p.unit}
                      </Badge>
                    </td>
                    <td className="hidden sm:table-cell">
                      <Badge tone={p.status === "active" ? "green" : "gray"}>{p.status}</Badge>
                    </td>
                    <td>
                      <ProductRowActions
                        product={toPlain(p)}
                        categories={cats}
                        suppliers={sups}
                        currency={ctx.currency}
                        locations={locs}
                        canUpdate={sessionCan(session, "products:update")}
                        canDelete={sessionCan(session, "products:delete")}
                        canAdjust={sessionCan(session, "inventory:adjust")}
                        canWrite={canWrite}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableCard>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState
            icon={Package}
            title={filtered ? "No products match your filters" : "No products yet"}
            description={filtered ? "Try a different search or clear the filters." : "Add your first product or import your catalogue from a CSV file."}
          />
        </div>
      )}
    </>
  );
}
