import Link from "next/link";
import { cn } from "@/utils/cn";

/** URL-driven tabs (Server Component friendly). */
export default function LinkTabs({ tabs, active, className }) {
  return (
    <div className={cn("scrollbar-thin -mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1", className)} role="tablist">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            role="tab"
            aria-selected={isActive}
            scroll={false}
            className={cn(
              "relative -mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              isActive ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
              t.disabled && "pointer-events-none opacity-50",
            )}
          >
            {t.icon ? <t.icon className="h-4 w-4" /> : null}
            {t.label}
            {t.badge ? <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600">{t.badge}</span> : null}
          </Link>
        );
      })}
    </div>
  );
}
