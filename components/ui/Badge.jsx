import { cn } from "@/utils/cn";

const TONES = {
  gray: "bg-slate-100 text-slate-700 ring-slate-500/10",
  brand: "bg-brand-50 text-brand-700 ring-brand-600/15",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  yellow: "bg-amber-50 text-amber-800 ring-amber-600/20",
  red: "bg-rose-50 text-rose-700 ring-rose-600/15",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/15",
  purple: "bg-violet-50 text-violet-700 ring-violet-600/15",
};

export default function Badge({ tone = "gray", className, children, dot = false }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", TONES[tone] || TONES.gray, className)}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

export const STATUS_TONES = {
  trialing: "blue",
  active: "green",
  expired: "red",
  cancelled: "yellow",
  past_due: "red",
  suspended: "red",
  completed: "green",
  paid: "green",
  partial: "yellow",
  unpaid: "red",
  success: "green",
  pending: "yellow",
  failed: "red",
  abandoned: "gray",
  reversed: "gray",
  inactive: "gray",
};
