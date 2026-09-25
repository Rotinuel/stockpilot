"use client";

import { useState } from "react";
import { Pencil, SlidersHorizontal } from "lucide-react";
import Button from "@/components/ui/Button";
import ProductFormModal from "./ProductForm";
import StockAdjustModal from "@/components/inventory/StockAdjustModal";

export default function ProductDetailActions({ product, categories, suppliers, locations, currency, canUpdate, canAdjust, canWrite }) {
  const [modal, setModal] = useState(null);
  return (
    <>
      {canAdjust ? (
        <Button variant="outline" icon={SlidersHorizontal} onClick={() => setModal("adjust")} disabled={!canWrite}>
          Adjust stock
        </Button>
      ) : null}
      {canUpdate ? (
        <Button icon={Pencil} onClick={() => setModal("edit")} disabled={!canWrite}>
          Edit
        </Button>
      ) : null}
      {modal === "edit" ? <ProductFormModal open onClose={() => setModal(null)} product={product} categories={categories} suppliers={suppliers} currency={currency} /> : null}
      {modal === "adjust" ? <StockAdjustModal open onClose={() => setModal(null)} product={product} locations={locations} /> : null}
    </>
  );
}
