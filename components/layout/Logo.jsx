import Link from "next/link";
import { cn } from "@/utils/cn";

export function LogoMark({ className }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#4f46e5" />
      <path d="M9 20.5 16 24l7-3.5M9 15.5 16 19l7-3.5M16 8l7 3.5-7 3.5-7-3.5L16 8Z" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Logo({ href = "/", className, light = false }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2", className)} aria-label="StockPilot home">
      <LogoMark />
      <span className={cn("text-lg font-bold tracking-tight", light ? "text-white" : "text-slate-900")}>
        Stock<span className="text-brand-600">Pilot</span>
      </span>
    </Link>
  );
}
