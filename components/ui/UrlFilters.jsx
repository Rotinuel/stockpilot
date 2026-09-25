"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, LoaderCircle } from "lucide-react";
import { cn } from "@/utils/cn";

function useUrlUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const update = (changes) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined || v === null || v === "") params.delete(k);
      else params.set(k, String(v));
    }
    params.delete("page"); // reset pagination on filter change
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { update, pending, searchParams };
}

/** Debounced search box bound to a URL query param (server-side filtering). */
export function SearchInput({ param = "q", placeholder = "Search…", className, delay = 350 }) {
  const { update, pending, searchParams } = useUrlUpdater();
  const [value, setValue] = useState(searchParams.get(param) || "");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => update({ [param]: value.trim() }), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input type="search" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="field-input pr-9 pl-9" aria-label={placeholder} />
      {pending ? <LoaderCircle className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" /> : null}
    </div>
  );
}

/** Select bound to a URL query param. */
export function FilterSelect({ param, options, placeholder = "All", className }) {
  const { update, searchParams } = useUrlUpdater();
  return (
    <select value={searchParams.get(param) || ""} onChange={(e) => update({ [param]: e.target.value })} className={cn("field-input w-full sm:w-auto", className)} aria-label={placeholder}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Date-range preset selector with optional custom from/to. */
export function RangeFilter({ presets, defaultValue = "this_month", className }) {
  const { update, searchParams } = useUrlUpdater();
  const current = searchParams.get("range") || defaultValue;
  const [from, setFrom] = useState(searchParams.get("from") || "");
  const [to, setTo] = useState(searchParams.get("to") || "");
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <select value={current} onChange={(e) => update({ range: e.target.value, from: e.target.value === "custom" ? from : "", to: e.target.value === "custom" ? to : "" })} className="field-input w-auto" aria-label="Date range">
        {presets.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {current === "custom" ? (
        <>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field-input w-auto" aria-label="From" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field-input w-auto" aria-label="To" />
          <button type="button" onClick={() => from && to && update({ range: "custom", from, to })} className="h-10 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800">
            Apply
          </button>
        </>
      ) : null}
    </div>
  );
}
