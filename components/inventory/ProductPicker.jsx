"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { apiFetch } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";

/** Async product search (server-side, max 12 results). */
export default function ProductPicker({ value, onChange, placeholder = "Search product by name, SKU or barcode", autoFocus = false, clearOnSelect = false, includeInactive = false }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const debounced = useDebounce(q, 250);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    apiFetch(`/api/products/lookup?q=${encodeURIComponent(debounced)}`, { signal: ctrl.signal })
      .then((r) => {
        setItems(r.items);
        setActive(0);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [debounced, open]);

  useEffect(() => {
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (item) => {
    onChange(item);
    setOpen(false);
    setQ(clearOnSelect ? "" : "");
  };

  if (value && !clearOnSelect) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
        <span className="truncate">
          <strong>{value.name}</strong> <span className="text-slate-500">· {value.sku}</span>
        </span>
        <button type="button" onClick={() => onChange(null)} className="rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label="Clear">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        className="field-input pl-9"
        value={q}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(items.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && items[active]) {
            e.preventDefault();
            pick(items[active]);
          }
        }}
      />
      {open && items.length ? (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-pop">
          {items.map((it, i) => (
            <li key={it.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(it)} className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${i === active ? "bg-brand-50" : "hover:bg-slate-50"}`}>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-900">{it.name}</span>
                  <span className="text-xs text-slate-500">{it.sku}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  {it.quantity} {it.unit}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
