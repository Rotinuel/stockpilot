"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImageOff, LoaderCircle, Trash2 } from "lucide-react";
import { apiFetch, useAction } from "@/hooks/useApi";
import { useImageUpload } from "@/components/ui/ImageUpload";
import { cn } from "@/utils/cn";

function useProductPhoto(productId) {
  const router = useRouter();
  const { upload, busy: uploading } = useImageUpload("product");
  const { run, loading: saving } = useAction();
  const save = async (image, success) => {
    const res = await run(() => apiFetch(`/api/products/${productId}`, { method: "PATCH", body: { image } }), { success });
    if (res) router.refresh();
    return Boolean(res);
  };
  const replace = async (file) => {
    if (!file) return;
    const url = await upload(file);
    if (url) await save(url, "Photo saved");
  };
  return { replace, remove: () => save("", "Photo removed"), busy: uploading || saving };
}

/** Large photo card on the product page. Editors can tap/drag to add or change the photo. */
export function ProductPhotoCard({ productId, image, name, canEdit }) {
  const input = useRef(null);
  const [drag, setDrag] = useState(false);
  const { replace, remove, busy } = useProductPhoto(productId);

  if (!canEdit) {
    return image ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt={name} className="h-full max-h-80 w-full object-contain" />
    ) : (
      <div className="flex h-56 flex-col items-center justify-center gap-2 bg-slate-50 text-sm text-slate-400">
        <ImageOff className="h-6 w-6" /> No photo
      </div>
    );
  }

  const open = () => !busy && input.current?.click();
  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open())}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          replace(e.dataTransfer.files?.[0]);
        }}
        className={cn("group relative flex min-h-56 cursor-pointer items-center justify-center", drag ? "bg-brand-50" : image ? "bg-white" : "bg-slate-50 hover:bg-brand-50/40")}
        aria-label={image ? "Change product photo" : "Add product photo"}
      >
        {image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={name} className="h-full max-h-80 w-full object-contain" />
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-slate-900/60 py-2 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-3.5 w-3.5" /> Change photo
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand-600 shadow-xs">
              <Camera className="h-6 w-6" />
            </span>
            <span className="text-sm font-semibold text-slate-800">Add a product photo</span>
            <span className="text-xs text-slate-500">Tap to take a photo or choose one · or drag it here</span>
          </div>
        )}
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <LoaderCircle className="h-6 w-6 animate-spin text-brand-600" />
          </span>
        ) : null}
      </div>
      {image && !busy ? (
        <button type="button" onClick={remove} className="absolute top-2 right-2 rounded-lg bg-white/90 p-1.5 text-slate-500 shadow-xs hover:bg-rose-50 hover:text-rose-600" aria-label="Remove photo">
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          replace(f);
        }}
      />
    </div>
  );
}

/** Small thumbnail in the products table. Editors can click it to add/change the photo in place. */
export function ProductThumb({ productId, image, canEdit }) {
  const input = useRef(null);
  const { replace, busy } = useProductPhoto(productId);
  const inner = busy ? (
    <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />
  ) : image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
  ) : canEdit ? (
    <Camera className="h-4 w-4 text-slate-400 group-hover:text-brand-600" />
  ) : (
    <ImageOff className="h-4 w-4 text-slate-300" />
  );
  const box = "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100";
  if (!canEdit) return <div className={box}>{inner}</div>;
  return (
    <>
      <button
        type="button"
        onClick={() => !busy && input.current?.click()}
        className={cn(box, "group", image ? "" : "border border-dashed border-slate-300 hover:border-brand-400 hover:bg-brand-50")}
        title={image ? "Change photo" : "Add photo"}
        aria-label={image ? "Change photo" : "Add photo"}
      >
        {inner}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          replace(f);
        }}
      />
    </>
  );
}
