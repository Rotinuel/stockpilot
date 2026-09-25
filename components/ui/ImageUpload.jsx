"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2, LoaderCircle } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";
import { useToast } from "./Toast";

async function resize(file, max = 800) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82));
}

/** Uploads a client-side-resized image and returns its URL via onChange. */
export default function ImageUpload({ value, onChange, kind = "product", label = "Upload image", className = "" }) {
  const input = useRef(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast.error("Unsupported file", "Choose a JPEG, PNG or WebP image.");
    setBusy(true);
    try {
      const blob = await resize(file);
      const fd = new FormData();
      fd.append("file", blob, "image.jpg");
      fd.append("kind", kind);
      const res = await apiFetch("/api/assets", { method: "POST", body: fd });
      onChange(res.url);
    } catch (err) {
      toast.error("Upload failed", err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
        {busy ? (
          <LoaderCircle className="h-5 w-5 animate-spin text-slate-400" />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus className="h-5 w-5 text-slate-400" />
        )}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => input.current?.click()} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" disabled={busy}>
          {value ? "Change" : label}
        </button>
        {value ? (
          <button type="button" onClick={() => onChange("")} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove image">
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
    </div>
  );
}
