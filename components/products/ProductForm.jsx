"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import ImageUpload from "@/components/ui/ImageUpload";
import { apiFetch, useAction } from "@/hooks/useApi";
import { UNITS } from "@/lib/constants";
import { formatMoney, marginPercent } from "@/lib/money";

const EMPTY = {
  name: "",
  sku: "",
  barcode: "",
  categoryId: "",
  categoryName: "",
  brand: "",
  unit: "piece",
  costPrice: "",
  sellingPrice: "",
  quantity: "",
  minimumStockLevel: "5",
  supplierId: "",
  status: "active",
  description: "",
  image: "",
};

export default function ProductFormModal({ open, onClose, product, categories = [], suppliers = [], currency = "NGN", onSaved }) {
  const isEdit = Boolean(product?._id);
  const [values, setValues] = useState(() =>
    product
      ? {
          ...EMPTY,
          ...product,
          categoryId: product.categoryId || "",
          supplierId: product.supplierId || "",
          barcode: product.barcode || "",
          brand: product.brand || "",
          description: product.description || "",
          image: product.image || "",
          costPrice: String(product.costPrice ?? ""),
          sellingPrice: String(product.sellingPrice ?? ""),
          minimumStockLevel: String(product.minimumStockLevel ?? ""),
        }
      : EMPTY,
  );
  const [newCategory, setNewCategory] = useState(false);
  const { run, loading, errors } = useAction();
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e?.target ? e.target.value : e }));

  const margin = marginPercent(values.sellingPrice, values.costPrice);
  const profit = (Number(values.sellingPrice) || 0) - (Number(values.costPrice) || 0);

  const submit = async (e) => {
    e.preventDefault();
    const body = {
      name: values.name,
      sku: values.sku || undefined,
      barcode: values.barcode || (isEdit ? "" : undefined),
      categoryId: newCategory ? undefined : values.categoryId || (isEdit ? "none" : undefined),
      categoryName: newCategory ? values.categoryName : undefined,
      brand: values.brand,
      unit: values.unit,
      costPrice: values.costPrice || 0,
      sellingPrice: values.sellingPrice,
      minimumStockLevel: values.minimumStockLevel || 0,
      supplierId: values.supplierId || (isEdit ? "none" : undefined),
      status: values.status,
      description: values.description,
      image: values.image,
    };
    if (!isEdit) body.quantity = values.quantity || 0;
    if (isEdit && newCategory && values.categoryName) {
      // create category first, then attach
      const cat = await run(() => apiFetch("/api/categories", { method: "POST", body: { name: values.categoryName } }));
      if (!cat) return;
      body.categoryId = cat.category._id;
      delete body.categoryName;
    }
    const res = await run(() => apiFetch(isEdit ? `/api/products/${product._id}` : "/api/products", { method: isEdit ? "PATCH" : "POST", body }), {
      success: isEdit ? "Product updated" : "Product added",
      refresh: true,
    });
    if (res) {
      onSaved?.(res.product);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? "Edit product" : "Add product"}
      description={isEdit ? "Stock quantity changes are made from Inventory so every change is recorded." : "Opening stock is recorded as an inventory movement."}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" loading={loading}>
            {isEdit ? "Save changes" : "Add product"}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Product photo" className="sm:col-span-2" error={errors.image}>
          <ImageUpload variant="dropzone" label={values.image ? "Change photo" : "Add a product photo"} value={values.image} onChange={(url) => setValues((v) => ({ ...v, image: url }))} />
        </Field>
        <Field label="Product name" htmlFor="name" error={errors.name} required className="sm:col-span-2">
          <Input id="name" value={values.name} onChange={set("name")} placeholder="e.g. Peak Milk 400g Tin" required />
        </Field>
        <Field label="SKU" htmlFor="sku" error={errors.sku} hint={isEdit ? undefined : "Leave blank to auto-generate"}>
          <Input id="sku" value={values.sku} onChange={set("sku")} placeholder="PEAK-400" className="uppercase" />
        </Field>
        <Field label="Barcode" htmlFor="barcode" error={errors.barcode}>
          <Input id="barcode" value={values.barcode} onChange={set("barcode")} placeholder="Scan or type" inputMode="numeric" />
        </Field>
        <Field label="Category" htmlFor="categoryId" error={errors.categoryId || errors.categoryName}>
          {newCategory ? (
            <div className="flex gap-2">
              <Input id="categoryName" value={values.categoryName} onChange={set("categoryName")} placeholder="New category name" />
              <Button variant="ghost" size="sm" onClick={() => setNewCategory(false)} className="h-10">
                Cancel
              </Button>
            </div>
          ) : (
            <Select
              id="categoryId"
              value={values.categoryId}
              onChange={(e) => (e.target.value === "__new" ? setNewCategory(true) : set("categoryId")(e))}
            >
              <option value="">Uncategorised</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
              <option value="__new">+ Create new category…</option>
            </Select>
          )}
        </Field>
        <Field label="Brand" htmlFor="brand" error={errors.brand}>
          <Input id="brand" value={values.brand} onChange={set("brand")} placeholder="e.g. FrieslandCampina" />
        </Field>
        <Field label={`Cost price (${currency})`} htmlFor="costPrice" error={errors.costPrice}>
          <Input id="costPrice" type="number" min="0" step="0.01" inputMode="decimal" value={values.costPrice} onChange={set("costPrice")} />
        </Field>
        <Field
          label={`Selling price (${currency})`}
          htmlFor="sellingPrice"
          error={errors.sellingPrice}
          required
          hint={values.sellingPrice ? `Profit per unit: ${formatMoney(profit, currency)} (${margin}% margin)` : undefined}
        >
          <Input id="sellingPrice" type="number" min="0" step="0.01" inputMode="decimal" value={values.sellingPrice} onChange={set("sellingPrice")} required />
        </Field>
        <Field label="Unit" htmlFor="unit" error={errors.unit}>
          <Select id="unit" value={values.unit} onChange={set("unit")}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
        {!isEdit ? (
          <Field label="Opening stock" htmlFor="quantity" error={errors.quantity}>
            <Input id="quantity" type="number" min="0" step="any" inputMode="decimal" value={values.quantity} onChange={set("quantity")} placeholder="0" />
          </Field>
        ) : (
          <Field label="Current stock">
            <Input value={`${product.quantity} ${product.unit}`} disabled readOnly />
          </Field>
        )}
        <Field label="Low-stock alert level" htmlFor="minimumStockLevel" error={errors.minimumStockLevel} hint="Alert when quantity is at or below this">
          <Input id="minimumStockLevel" type="number" min="0" step="any" value={values.minimumStockLevel} onChange={set("minimumStockLevel")} />
        </Field>
        <Field label="Supplier" htmlFor="supplierId" error={errors.supplierId}>
          <Select id="supplierId" value={values.supplierId} onChange={set("supplierId")}>
            <option value="">None</option>
            {suppliers.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
                {s.company ? ` — ${s.company}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" value={values.status} onChange={set("status")}>
            <option value="active">Active (sellable)</option>
            <option value="inactive">Inactive (hidden from POS)</option>
          </Select>
        </Field>
        <Field label="Description" htmlFor="description" error={errors.description} className="sm:col-span-2">
          <Textarea id="description" value={values.description} onChange={set("description")} rows={2} />
        </Field>
      </form>
    </Modal>
  );
}
