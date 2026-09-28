"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Trash2, LoaderCircle, Camera } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";
import { cn } from "@/utils/cn";
import { useToast } from "./Toast";

const MAX_BYTES = 580 * 1024; // server limit is 600 KB
const MAX_ORIGINAL = 25 * 1024 * 1024;

async function decode(file) {
  // createImageBitmap honours EXIF rotation (phone photos) in modern browsers.
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {}
  }
  // Fallback: let the browser's <img> decoder try (e.g. HEIC on Safari).
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Resize to max 1000px, flatten on white (PNG transparency) and compress to JPEG under the size limit. */
export async function prepareImage(file, max = 1000) {
  if (!file) throw new Error("No file selected.");
  if (file.type && !file.type.startsWith("image/")) throw new Error("That file isn't an image. Choose a JPG, PNG or WebP photo.");
  if (file.size > MAX_ORIGINAL) throw new Error("That photo is larger than 25 MB. Choose a smaller one.");
  let source;
  try {
    source = await decode(file);
  } catch {
    throw new Error("This photo format isn't supported by your browser. Save it as JPG or PNG and try again.");
  }
  const w = source.width || source.naturalWidth;
  const h = source.height || source.naturalHeight;
  let size = max;
  for (let attempt = 0; attempt < 4; attempt++) {
    const scale = Math.min(1, size / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const g = canvas.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", attempt ? 0.72 : 0.84));
    if (blob && blob.size <= MAX_BYTES) return blob;
    size = Math.round(size * 0.75);
  }
  throw new Error("Couldn't shrink this photo enough. Try a different one.");
}

/** Hook: `const { upload, busy } = useImageUpload("product")` → `const url = await upload(file)` (null on failure). */
export function useImageUpload(kind = "product") {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const upload = useCallback(
    async (file) => {
      setBusy(true);
      try {
        const blob = await prepareImage(file);
        const fd = new FormData();
        fd.append("file", blob, "image.jpg");
        fd.append("kind", kind);
        const res = await apiFetch("/api/assets", { method: "POST", body: fd });
        return res.url;
      } catch (err) {
        toast.error("Photo not uploaded", err.message);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [kind, toast],
  );
  return { upload, busy };
}

/**
 * Uploads a client-side-resized image and returns its URL via onChange.
 * variant "inline" (small thumbnail + button) or "dropzone" (large tap/drag area with preview).
 */
export default function ImageUpload({ value, onChange, kind = "product", label = "Upload image", variant = "inline", className = "", hint }) {
  const input = useRef(null);
  const { upload, busy } = useImageUpload(kind);
  const [drag, setDrag] = useState(false);

  const handle = async (file) => {
    if (!file) return;
    const url = await upload(file);
    if (url) onChange(url);
  };
  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    handle(file);
  };
  const picker = <input ref={input} type="file" accept="image/*" className="hidden" onChange={onFile} />;
  const open = () => !busy && input.current?.click();

  if (variant === "dropzone") {
    return (
      <div className={className}>
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
            handle(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "group relative flex h-40 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors focus-visible:outline-2 focus-visible:outline-brand-500",
            drag ? "border-brand-500 bg-brand-50" : value ? "border-slate-200 bg-white" : "border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-brand-50/40",
          )}
          aria-label={value ? "Change photo" : label}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-1.5 px-4 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-600 shadow-xs">
                <Camera className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-slate-800">{label}</span>
              <span className="text-xs text-slate-500">{hint || "Tap to take a photo or choose one · or drag it here"}</span>
            </div>
          )}
          {value && !busy ? (
            <span className="absolute inset-x-0 bottom-0 bg-slate-900/60 py-1.5 text-center text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">Change photo</span>
          ) : null}
          {busy ? (
            <span className="absolute inset-0 flex items-center justify-center bg-white/70">
              <LoaderCircle className="h-6 w-6 animate-spin text-brand-600" />
            </span>
          ) : null}
        </div>
        {value && !busy ? (
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={open} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Change photo
            </button>
            <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-rose-50 hover:text-rose-600">
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          </div>
        ) : null}
        {picker}
      </div>
    );
  }

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
        <button type="button" onClick={open} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" disabled={busy}>
          {value ? "Change" : label}
        </button>
        {value ? (
          <button type="button" onClick={() => onChange("")} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove image">
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {picker}
    </div>
  );
}
