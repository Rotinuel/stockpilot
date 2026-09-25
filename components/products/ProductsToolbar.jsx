"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Plus, Upload, Download, Tags, Trash2, Pencil } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input } from "@/components/ui/Field";
import { useConfirm } from "@/components/ui/Confirm";
import { apiFetch, useAction } from "@/hooks/useApi";
import ProductFormModal from "./ProductForm";

export default function ProductsToolbar({ categories, suppliers, currency, canCreate, canImport, canExport, canManageCategories, canWrite }) {
  const [modal, setModal] = useState(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (searchParams.get("new") === "1" && canCreate && canWrite) {
      setModal("create");
      const params = new URLSearchParams(searchParams.toString());
      params.delete("new");
      router.replace(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
    }
  }, [searchParams, canCreate, canWrite, router, pathname]);

  const exportHref = `/api/products/export?${new URLSearchParams(Object.fromEntries([...searchParams.entries()].filter(([k]) => ["q", "category", "status", "stock"].includes(k))))}`;

  return (
    <>
      {canManageCategories ? (
        <Button variant="outline" icon={Tags} onClick={() => setModal("categories")}>
          <span className="hidden sm:inline">Categories</span>
        </Button>
      ) : null}
      {canExport ? (
        <Button variant="outline" icon={Download} href={exportHref} prefetch={false}>
          <span className="hidden sm:inline">Export</span>
        </Button>
      ) : null}
      {canImport ? (
        <Button variant="outline" icon={Upload} onClick={() => setModal("import")} disabled={!canWrite}>
          <span className="hidden sm:inline">Import</span>
        </Button>
      ) : null}
      {canCreate ? (
        <Button icon={Plus} onClick={() => setModal("create")} disabled={!canWrite}>
          Add product
        </Button>
      ) : null}
      {modal === "create" ? <ProductFormModal open onClose={() => setModal(null)} categories={categories} suppliers={suppliers} currency={currency} /> : null}
      {modal === "import" ? <ImportModal onClose={() => setModal(null)} /> : null}
      {modal === "categories" ? <CategoriesModal onClose={() => setModal(null)} initial={categories} canWrite={canWrite} /> : null}
    </>
  );
}

function ImportModal({ onClose }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const { run, loading } = useAction();
  const template = "name,sku,barcode,category,brand,cost_price,selling_price,quantity,minimum_stock_level,unit\nIndomie Chicken 70g,IND-70,,Noodles,Indomie,95,130,120,24,pack\n";
  const submit = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await run(() => apiFetch("/api/products/import", { method: "POST", body: fd }), { refresh: true });
    if (res) setResult(res);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Import products from CSV"
      description="Existing SKUs are updated (prices, names). New rows are created with their opening stock."
      footer={
        result ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} loading={loading} disabled={!file}>
              Import
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-3 text-sm">
          <p>
            <strong>{result.created}</strong> created · <strong>{result.updated}</strong> updated · <strong>{result.errors.length}</strong> errors
          </p>
          {result.errors.length ? (
            <ul className="max-h-48 overflow-y-auto rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
              {result.errors.map((e) => (
                <li key={e.row}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-medium file:text-brand-700" />
          <p className="text-slate-500">
            Required columns: <code>name</code>, <code>selling_price</code>. Optional: sku, barcode, category, brand, cost_price, quantity, minimum_stock_level, unit.
          </p>
          <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`} download="stockpilot-products-template.csv" className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700">
            <Download className="h-4 w-4" /> Download template
          </a>
        </div>
      )}
    </Modal>
  );
}

function CategoriesModal({ onClose, initial, canWrite }) {
  const [items, setItems] = useState(initial);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null);
  const { run, loading } = useAction();
  const confirm = useConfirm();
  const reload = async () => {
    const res = await apiFetch("/api/categories");
    setItems(res.items.map((c) => ({ ...c, _id: String(c._id) })));
  };
  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await run(() => apiFetch("/api/categories", { method: "POST", body: { name } }), { success: "Category added", refresh: true });
    if (res) {
      setName("");
      reload();
    }
  };
  const rename = async (id, newName) => {
    const res = await run(() => apiFetch(`/api/categories/${id}`, { method: "PATCH", body: { name: newName } }), { refresh: true });
    if (res) {
      setEditing(null);
      reload();
    }
  };
  const remove = async (c) => {
    if (!(await confirm({ title: "Delete category?", message: `"${c.name}" will be removed. Products in it become uncategorised.`, confirmLabel: "Delete", tone: "danger" }))) return;
    const res = await run(() => apiFetch(`/api/categories/${c._id}`, { method: "DELETE" }), { success: "Category deleted", refresh: true });
    if (res) reload();
  };
  return (
    <Modal open onClose={onClose} title="Product categories">
      {canWrite ? (
        <form onSubmit={add} className="mb-4 flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category, e.g. Beverages" />
          <Button type="submit" loading={loading} icon={Plus}>
            Add
          </Button>
        </form>
      ) : null}
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {items.length ? (
          items.map((c) => (
            <li key={c._id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              {editing === c._id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    rename(c._id, e.currentTarget.elements.cname.value);
                  }}
                >
                  <Input name="cname" defaultValue={c.name} autoFocus />
                  <Button type="submit" size="sm" className="h-10">
                    Save
                  </Button>
                </form>
              ) : (
                <>
                  <span>
                    {c.name} <span className="text-xs text-slate-400">· {c.productCount || 0} products</span>
                  </span>
                  {canWrite ? (
                    <span className="flex gap-1">
                      <button type="button" onClick={() => setEditing(c._id)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Rename">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => remove(c)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </span>
                  ) : null}
                </>
              )}
            </li>
          ))
        ) : (
          <li className="px-3 py-6 text-center text-sm text-slate-500">No categories yet.</li>
        )}
      </ul>
    </Modal>
  );
}
