"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ellipsis, Pencil, Trash2, Eye, SlidersHorizontal } from "lucide-react";
import Dropdown, { DropdownItem, DropdownSeparator } from "@/components/ui/Dropdown";
import { useConfirm } from "@/components/ui/Confirm";
import { apiFetch, useAction } from "@/hooks/useApi";
import ProductFormModal from "./ProductForm";
import StockAdjustModal from "@/components/inventory/StockAdjustModal";

export default function ProductRowActions({ product, categories, suppliers, currency, canUpdate, canDelete, canAdjust, canWrite, locations = [] }) {
  const [modal, setModal] = useState(null);
  const confirm = useConfirm();
  const router = useRouter();
  const { run } = useAction();

  const remove = async () => {
    const ok = await confirm({
      title: "Delete product?",
      message: `"${product.name}" will be removed from your catalogue and POS. Its sales and stock history are kept for your records.`,
      confirmLabel: "Delete product",
      tone: "danger",
    });
    if (!ok) return;
    await run(() => apiFetch(`/api/products/${product._id}`, { method: "DELETE" }), { success: "Product deleted", refresh: true });
  };

  return (
    <>
      <Dropdown
        trigger={
          <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`Actions for ${product.name}`}>
            <Ellipsis className="h-5 w-5" />
          </button>
        }
      >
        <DropdownItem icon={Eye} onClick={() => router.push(`/products/${product._id}`)}>
          View details
        </DropdownItem>
        {canUpdate ? (
          <DropdownItem icon={Pencil} onClick={() => setModal("edit")} disabled={!canWrite}>
            Edit
          </DropdownItem>
        ) : null}
        {canAdjust ? (
          <DropdownItem icon={SlidersHorizontal} onClick={() => setModal("adjust")} disabled={!canWrite}>
            Adjust stock
          </DropdownItem>
        ) : null}
        {canDelete ? (
          <>
            <DropdownSeparator />
            <DropdownItem icon={Trash2} tone="danger" onClick={remove} disabled={!canWrite}>
              Delete
            </DropdownItem>
          </>
        ) : null}
      </Dropdown>
      {modal === "edit" ? <ProductFormModal open onClose={() => setModal(null)} product={product} categories={categories} suppliers={suppliers} currency={currency} /> : null}
      {modal === "adjust" ? <StockAdjustModal open onClose={() => setModal(null)} product={product} locations={locations} /> : null}
    </>
  );
}
