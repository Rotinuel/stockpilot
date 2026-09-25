"use client";

import { useState } from "react";
import { SlidersHorizontal, ArrowLeftRight } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ProductPicker from "./ProductPicker";
import StockAdjustModal from "./StockAdjustModal";
import TransferModal from "./TransferModal";
import { apiFetch } from "@/hooks/useApi";

export default function InventoryActions({ locations, canAdjust, canTransfer, canWrite, transferLocked }) {
  const [modal, setModal] = useState(null);
  const [product, setProduct] = useState(null);

  const choose = async (p) => {
    if (!p) return;
    // Load the full product (for current total & unit)
    try {
      const res = await apiFetch(`/api/products/${p.id}`);
      setProduct({ ...res.product, _id: String(res.product._id) });
      setModal("adjust");
    } catch {}
  };

  return (
    <>
      {canTransfer && locations.length > 1 ? (
        <Button variant="outline" icon={ArrowLeftRight} onClick={() => setModal("transfer")} disabled={!canWrite || transferLocked} title={transferLocked ? "Multi-location is available on the Professional plan" : undefined}>
          Transfer
        </Button>
      ) : null}
      {canAdjust ? (
        <Button icon={SlidersHorizontal} onClick={() => setModal("pick")} disabled={!canWrite}>
          Adjust stock
        </Button>
      ) : null}
      {modal === "pick" ? (
        <Modal open onClose={() => setModal(null)} title="Which product?" description="Search for the product whose stock you want to change.">
          <div className="min-h-64">
            <ProductPicker onChange={choose} autoFocus clearOnSelect />
          </div>
        </Modal>
      ) : null}
      {modal === "adjust" && product ? <StockAdjustModal open onClose={() => setModal(null)} product={product} locations={locations} /> : null}
      {modal === "transfer" ? <TransferModal open onClose={() => setModal(null)} locations={locations} /> : null}
    </>
  );
}
