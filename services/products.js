import Product from "../models/Product.js";
import ProductStock from "../models/ProductStock.js";
import Category from "../models/Category.js";
import Supplier from "../models/Supplier.js";
import InventoryMovement from "../models/InventoryMovement.js";
import { byId, scoped } from "./_scope.js";
import { badRequest, notFound, conflict } from "../lib/errors.js";
import { withTransaction, Compensation, isValidObjectId } from "../lib/db.js";
import { assertCanAddProducts } from "./limits.js";
import { applyStockChange, stockByLocation } from "./stock.js";
import { resolveLocation } from "./locations.js";
import { nextSequence } from "./counters.js";
import { logAudit } from "./audit.js";
import { escapeRegex } from "../utils/slug.js";
import { parseCSV, toCSV } from "../utils/csv.js";
import { round2 } from "../lib/money.js";
import { UNITS } from "../lib/constants.js";
import { productSchema } from "../lib/validators.js";

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name_asc: { name: 1 },
  name_desc: { name: -1 },
  price_asc: { sellingPrice: 1 },
  price_desc: { sellingPrice: -1 },
  qty_asc: { quantity: 1 },
  qty_desc: { quantity: -1 },
};

export function productFilter(ctx, { search, categoryId, status, stock, supplierId } = {}) {
  const filter = scoped(ctx, { isDeleted: false });
  if (search) {
    const rx = { $regex: escapeRegex(search.trim()), $options: "i" };
    filter.$or = [{ name: rx }, { sku: rx }, { barcode: search.trim() }, { brand: rx }];
  }
  if (categoryId && isValidObjectId(categoryId)) filter.categoryId = categoryId;
  if (supplierId && isValidObjectId(supplierId)) filter.supplierId = supplierId;
  if (status && ["active", "inactive"].includes(status)) filter.status = status;
  if (stock === "out") filter.quantity = { $lte: 0 };
  if (stock === "low") filter.$expr = { $lte: ["$quantity", "$minimumStockLevel"] };
  if (stock === "in") filter.$expr = { $gt: ["$quantity", "$minimumStockLevel"] };
  return filter;
}

export async function listProducts(ctx, { page = 1, limit = 20, sort = "newest", ...filters } = {}) {
  const filter = productFilter(ctx, filters);
  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort(SORTS[sort] || SORTS.newest)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);
  const catIds = [...new Set(items.map((p) => p.categoryId && String(p.categoryId)).filter(Boolean))];
  const cats = catIds.length ? await Category.find(scoped(ctx, { _id: { $in: catIds } })).select("name").lean() : [];
  const catMap = new Map(cats.map((c) => [String(c._id), c.name]));
  return {
    items: items.map((p) => ({ ...p, categoryName: p.categoryId ? catMap.get(String(p.categoryId)) || "" : "" })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getProduct(ctx, id) {
  const product = await Product.findOne(byId(ctx, id, { isDeleted: false })).lean();
  if (!product) throw notFound("Product not found.");
  const [category, supplier, locations, movements] = await Promise.all([
    product.categoryId ? Category.findOne(scoped(ctx, { _id: product.categoryId })).lean() : null,
    product.supplierId ? Supplier.findOne(scoped(ctx, { _id: product.supplierId })).select("name company phone").lean() : null,
    stockByLocation(ctx, product._id),
    InventoryMovement.find(scoped(ctx, { productId: product._id })).sort({ createdAt: -1 }).limit(15).lean(),
  ]);
  return { product, category, supplier, locations, movements };
}

async function resolveCategory(ctx, { categoryId, categoryName }) {
  if (categoryId) {
    const cat = await Category.findOne(byId(ctx, categoryId)).lean();
    if (!cat) throw badRequest("Selected category does not exist.");
    return cat._id;
  }
  if (categoryName) {
    const name = categoryName.trim();
    const existing = await Category.findOne(scoped(ctx, { name })).collation({ locale: "en", strength: 2 }).lean();
    if (existing) return existing._id;
    const created = await Category.create({ tenantId: ctx.tenantId, name });
    return created._id;
  }
  return null;
}

async function assertSupplier(ctx, supplierId) {
  if (!supplierId) return null;
  const s = await Supplier.exists(byId(ctx, supplierId, { isDeleted: false }));
  if (!s) throw badRequest("Selected supplier does not exist.");
  return supplierId;
}

async function generateSku(ctx) {
  const seq = await nextSequence(ctx.tenantId, "sku");
  return `SKU-${String(seq).padStart(5, "0")}`;
}

export async function createProduct(ctx, data, request, { skipLimit = false, audit = true } = {}) {
  if (!skipLimit) await assertCanAddProducts(ctx);
  const categoryId = await resolveCategory(ctx, data);
  const supplierId = await assertSupplier(ctx, data.supplierId);
  let sku = data.sku ? data.sku.toUpperCase() : await generateSku(ctx);

  const exists = await Product.exists(scoped(ctx, { sku, isDeleted: false }));
  if (exists) throw conflict("SKU is already in use.", { sku: "SKU is already in use." });
  if (data.barcode) {
    const bc = await Product.exists(scoped(ctx, { barcode: data.barcode, isDeleted: false }));
    if (bc) throw conflict("Barcode is already in use.", { barcode: "Barcode is already in use." });
  }

  const openingQty = Number(data.quantity || 0);
  const doc = {
    tenantId: ctx.tenantId,
    name: data.name,
    sku,
    barcode: data.barcode || undefined,
    categoryId,
    brand: data.brand,
    description: data.description,
    costPrice: round2(data.costPrice || 0),
    sellingPrice: round2(data.sellingPrice),
    quantity: 0,
    minimumStockLevel: Number(data.minimumStockLevel || 0),
    unit: data.unit || "piece",
    supplierId,
    image: data.image || "",
    status: data.status || "active",
    createdBy: ctx.userId,
  };

  const product = await withTransaction(async (session) => {
    const comp = new Compensation(!session);
    try {
      const [created] = await Product.create([doc], session ? { session } : {});
      comp.add(() => Product.deleteOne({ _id: created._id }));
      if (openingQty > 0) {
        const location = await resolveLocation(ctx, data.locationId);
        await applyStockChange({
          ctx,
          product: created.toObject(),
          locationId: location._id,
          delta: openingQty,
          type: "opening_stock",
          reason: "Opening stock",
          referenceId: created._id,
          referenceType: "Product",
          unitCost: doc.costPrice,
          session,
          comp,
        });
      }
      return created;
    } catch (err) {
      await comp.rollback();
      throw err;
    }
  });

  if (audit) {
    await logAudit(ctx, "product.create", { entity: "Product", entityId: product._id, metadata: { name: product.name, sku, openingQty }, request });
  }
  return Product.findById(product._id).lean();
}

export async function updateProduct(ctx, id, data, request) {
  const current = await Product.findOne(byId(ctx, id, { isDeleted: false })).lean();
  if (!current) throw notFound("Product not found.");
  const $set = {};
  const $unset = {};
  for (const key of ["name", "brand", "description", "unit", "status", "image"]) {
    if (data[key] !== undefined) $set[key] = data[key];
  }
  for (const key of ["costPrice", "sellingPrice"]) if (data[key] !== undefined) $set[key] = round2(data[key]);
  if (data.minimumStockLevel !== undefined) $set.minimumStockLevel = Number(data.minimumStockLevel);
  if (data.sku !== undefined && data.sku.toUpperCase() !== current.sku) {
    const sku = data.sku.toUpperCase();
    if (await Product.exists(scoped(ctx, { sku, isDeleted: false, _id: { $ne: current._id } }))) {
      throw conflict("SKU is already in use.", { sku: "SKU is already in use." });
    }
    $set.sku = sku;
  }
  if (data.barcode !== undefined) {
    if (data.barcode === null) $unset.barcode = 1;
    else if (data.barcode !== current.barcode) {
      if (await Product.exists(scoped(ctx, { barcode: data.barcode, isDeleted: false, _id: { $ne: current._id } }))) {
        throw conflict("Barcode is already in use.", { barcode: "Barcode is already in use." });
      }
      $set.barcode = data.barcode;
    }
  }
  if (data.categoryId !== undefined) $set.categoryId = data.categoryId ? await resolveCategory(ctx, { categoryId: data.categoryId }) : null;
  if (data.supplierId !== undefined) $set.supplierId = data.supplierId ? await assertSupplier(ctx, data.supplierId) : null;

  const update = {};
  if (Object.keys($set).length) update.$set = $set;
  if (Object.keys($unset).length) update.$unset = $unset;
  if (!Object.keys(update).length) return current;

  const product = await Product.findOneAndUpdate(byId(ctx, id, { isDeleted: false }), update, { new: true, runValidators: true }).lean();
  const changes = {};
  for (const k of Object.keys($set)) if (String(current[k] ?? "") !== String($set[k] ?? "")) changes[k] = { from: current[k], to: $set[k] };
  await logAudit(ctx, "product.update", { entity: "Product", entityId: product._id, metadata: { name: product.name, changes }, request });
  return product;
}

/** Soft delete: history (sales, movements) keeps referencing the product. */
export async function deleteProduct(ctx, id, request) {
  const product = await Product.findOneAndUpdate(
    byId(ctx, id, { isDeleted: false }),
    { $set: { isDeleted: true, deletedAt: new Date(), status: "inactive" } },
    { new: true },
  ).lean();
  if (!product) throw notFound("Product not found.");
  await logAudit(ctx, "product.delete", { entity: "Product", entityId: product._id, metadata: { name: product.name, sku: product.sku, quantity: product.quantity }, request });
  return { ok: true };
}

/** Fast lookup for the POS (barcode/SKU exact match first, then name search). */
export async function lookupProducts(ctx, q, { limit = 12, locationId } = {}) {
  const term = String(q || "").trim();
  const base = scoped(ctx, { isDeleted: false, status: "active" });
  let items = [];
  if (term) {
    const exact = await Product.find({ ...base, $or: [{ barcode: term }, { sku: term.toUpperCase() }] }).limit(1).lean();
    if (exact.length) items = exact;
    else {
      const rx = { $regex: escapeRegex(term), $options: "i" };
      items = await Product.find({ ...base, $or: [{ name: rx }, { sku: rx }, { brand: rx }] })
        .sort({ name: 1 })
        .limit(limit)
        .lean();
    }
  } else {
    items = await Product.find(base).sort({ updatedAt: -1 }).limit(limit).lean();
  }
  // Same location the POS and sales use by default (user's location, else the business default).
  const locId = (await resolveLocation(ctx, locationId).catch(() => null))?._id || null;
  const stock = locId
    ? await ProductStock.find(scoped(ctx, { locationId: locId, productId: { $in: items.map((i) => i._id) } })).lean()
    : [];
  const stockMap = new Map(stock.map((s) => [String(s.productId), s.quantity]));
  return items.map((p) => ({
    id: String(p._id),
    name: p.name,
    sku: p.sku,
    barcode: p.barcode || "",
    unit: p.unit,
    price: p.sellingPrice,
    image: p.image || "",
    quantity: locId ? stockMap.get(String(p._id)) || 0 : p.quantity,
    exact: items.length === 1 && term && (p.barcode === term || p.sku === term.toUpperCase()),
  }));
}

// ── Import / export ─────────────────────────────────────────
const num = (v) => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(String(v).replace(/[₦,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

export async function importProducts(ctx, csvText, request) {
  const rows = parseCSV(csvText);
  if (!rows.length) throw badRequest("The file has no data rows. Include a header row: name, sku, category, cost_price, selling_price, quantity, minimum_stock_level, unit.");
  if (rows.length > 2000) throw badRequest("Import up to 2,000 products at a time.");

  const result = { created: 0, updated: 0, skipped: 0, errors: [] };
  const newRows = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const input = {
      name: r.name || r.product_name,
      sku: r.sku || undefined,
      barcode: r.barcode || undefined,
      categoryName: r.category || undefined,
      brand: r.brand || undefined,
      description: r.description || undefined,
      costPrice: num(r.cost_price ?? r.cost) ?? 0,
      sellingPrice: num(r.selling_price ?? r.price),
      quantity: num(r.quantity ?? r.stock ?? r.opening_stock) ?? 0,
      minimumStockLevel: num(r.minimum_stock_level ?? r.min_stock ?? r.reorder_level) ?? 0,
      unit: UNITS.includes((r.unit || "").toLowerCase()) ? r.unit.toLowerCase() : "piece",
    };
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) {
      result.errors.push({ row: i + 2, message: parsed.error.issues[0]?.message || "Invalid row" });
      continue;
    }
    const data = parsed.data;
    if (data.sku) {
      const existing = await Product.findOne(scoped(ctx, { sku: data.sku.toUpperCase(), isDeleted: false })).lean();
      if (existing) {
        await Product.updateOne(
          { _id: existing._id, tenantId: ctx.tenantId },
          {
            $set: {
              name: data.name,
              costPrice: round2(data.costPrice),
              sellingPrice: round2(data.sellingPrice),
              minimumStockLevel: data.minimumStockLevel,
              unit: data.unit,
              ...(data.brand ? { brand: data.brand } : {}),
              ...(data.categoryName ? { categoryId: await resolveCategory(ctx, { categoryName: data.categoryName }) } : {}),
            },
          },
        );
        result.updated++;
        continue;
      }
    }
    newRows.push({ row: i + 2, data });
  }

  if (newRows.length) await assertCanAddProducts(ctx, newRows.length);
  for (const { row, data } of newRows) {
    try {
      await createProduct(ctx, data, request, { skipLimit: true, audit: false });
      result.created++;
    } catch (err) {
      result.errors.push({ row, message: err?.message || "Could not import row" });
    }
  }
  await logAudit(ctx, "product.import", { entity: "Product", metadata: { created: result.created, updated: result.updated, errors: result.errors.length }, request });
  return result;
}

export async function exportProductsCSV(ctx, filters = {}) {
  const filter = productFilter(ctx, filters);
  const [items, cats] = await Promise.all([
    Product.find(filter).sort({ name: 1 }).select("-image").limit(50_000).lean(),
    Category.find(scoped(ctx)).lean(),
  ]);
  const catMap = new Map(cats.map((c) => [String(c._id), c.name]));
  return toCSV(items, [
    { key: "name", label: "name" },
    { key: "sku", label: "sku" },
    { key: "barcode", label: "barcode" },
    { key: "category", label: "category", value: (p) => (p.categoryId ? catMap.get(String(p.categoryId)) || "" : "") },
    { key: "brand", label: "brand" },
    { key: "costPrice", label: "cost_price" },
    { key: "sellingPrice", label: "selling_price" },
    { key: "quantity", label: "quantity" },
    { key: "minimumStockLevel", label: "minimum_stock_level" },
    { key: "unit", label: "unit" },
    { key: "status", label: "status" },
  ]);
}

// ── Categories ──────────────────────────────────────────────
export async function listCategories(ctx) {
  const [cats, counts] = await Promise.all([
    Category.find(scoped(ctx)).sort({ name: 1 }).lean(),
    Product.aggregate([{ $match: scoped(ctx, { isDeleted: false }) }, { $group: { _id: "$categoryId", count: { $sum: 1 } } }]),
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  return cats.map((c) => ({ ...c, productCount: countMap.get(String(c._id)) || 0 }));
}

export async function createCategory(ctx, data, request) {
  const exists = await Category.findOne(scoped(ctx, { name: data.name })).collation({ locale: "en", strength: 2 }).lean();
  if (exists) throw conflict("A category with this name already exists.", { name: "Already exists" });
  const cat = await Category.create({ ...data, tenantId: ctx.tenantId });
  await logAudit(ctx, "category.create", { entity: "Category", entityId: cat._id, metadata: { name: cat.name }, request });
  return cat.toObject();
}

export async function updateCategory(ctx, id, data) {
  const cat = await Category.findOneAndUpdate(byId(ctx, id), { $set: data }, { new: true, runValidators: true }).lean();
  if (!cat) throw notFound("Category not found.");
  return cat;
}

export async function deleteCategory(ctx, id, request) {
  const cat = await Category.findOneAndDelete(byId(ctx, id)).lean();
  if (!cat) throw notFound("Category not found.");
  await Product.updateMany(scoped(ctx, { categoryId: cat._id }), { $set: { categoryId: null } });
  await logAudit(ctx, "category.delete", { entity: "Category", entityId: cat._id, metadata: { name: cat.name }, request });
  return { ok: true };
}

/**
 * Compact snapshot used by the POS to keep working offline
 * (products with stock at the location, customers, receipt details).
 */
export async function posCatalog(ctx, locationId) {
  const { default: Customer } = await import("../models/Customer.js");
  const { default: Tenant } = await import("../models/Tenant.js");
  // Same location the POS and sales use by default (user's location, else the business default).
  const locId = (await resolveLocation(ctx, locationId).catch(() => null))?._id || null;
  const [items, customers, tenant] = await Promise.all([
    Product.find(scoped(ctx, { isDeleted: false, status: "active" }))
      .select("name sku barcode unit sellingPrice image quantity")
      .sort({ name: 1 })
      .limit(5000)
      .lean(),
    Customer.find(scoped(ctx, { isDeleted: false })).select("name phone type balance creditLimit").sort({ name: 1 }).limit(3000).lean(),
    Tenant.findById(ctx.tenantId).select("businessName address phone logo currency settings").lean(),
  ]);
  const stock = locId ? await ProductStock.find(scoped(ctx, { locationId: locId })).select("productId quantity").lean() : [];
  const stockMap = new Map(stock.map((s) => [String(s.productId), s.quantity]));
  return {
    tenantId: String(ctx.tenantId),
    locationId: locId ? String(locId) : "",
    generatedAt: new Date().toISOString(),
    business: {
      businessName: tenant?.businessName,
      address: tenant?.address,
      phone: tenant?.phone,
      logo: tenant?.logo,
      settings: {
        taxRate: tenant?.settings?.taxRate || 0,
        taxLabel: tenant?.settings?.taxLabel || "VAT",
        receiptHeader: tenant?.settings?.receiptHeader,
        receiptFooter: tenant?.settings?.receiptFooter,
        showLogoOnReceipt: tenant?.settings?.showLogoOnReceipt,
      },
    },
    products: items.map((p) => ({
      id: String(p._id),
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || "",
      unit: p.unit,
      price: p.sellingPrice,
      image: p.image || "",
      quantity: locId ? stockMap.get(String(p._id)) || 0 : p.quantity,
    })),
    customers: customers.map((c) => ({ _id: String(c._id), name: c.name, phone: c.phone || "", type: c.type, balance: c.balance || 0, creditLimit: c.creditLimit || 0 })),
  };
}
