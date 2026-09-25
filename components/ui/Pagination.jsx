import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";

export function buildHref(basePath, searchParams = {}, overrides = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...searchParams, ...overrides })) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, Array.isArray(v) ? v[0] : String(v));
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Link-based pagination (works in Server Components; no client JS). */
export default function Pagination({ page, pages, total, basePath, searchParams = {}, label = "results" }) {
  if (!total) return null;
  const prev = page > 1 ? buildHref(basePath, searchParams, { page: page - 1 }) : null;
  const next = page < pages ? buildHref(basePath, searchParams, { page: page + 1 }) : null;
  const cls = "inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-600 transition";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
      <span>
        Page <strong className="text-slate-800">{page}</strong> of {pages} · {total.toLocaleString("en-NG")} {label}
      </span>
      <div className="flex items-center gap-2">
        {prev ? (
          <Link href={prev} className={cn(cls, "hover:bg-slate-50")} scroll={false}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Link>
        ) : (
          <span className={cn(cls, "cursor-not-allowed opacity-40")}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </span>
        )}
        {next ? (
          <Link href={next} className={cn(cls, "hover:bg-slate-50")} scroll={false}>
            Next <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className={cn(cls, "cursor-not-allowed opacity-40")}>
            Next <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}
