import Link from "next/link";
import { cn } from "@/utils/cn";
import { initials } from "@/utils/format";

export function PageHeader({ title, description, actions, back, className }) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
            ← {back.label}
          </Link>
        ) : null}
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "brand", trend, href }) {
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-rose-50 text-rose-600",
    yellow: "bg-amber-50 text-amber-600",
    blue: "bg-sky-50 text-sky-600",
    purple: "bg-violet-50 text-violet-600",
    gray: "bg-slate-100 text-slate-600",
  };
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
        <p className="mt-1.5 truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{value}</p>
        {hint ? <p className="mt-1 truncate text-xs text-slate-500">{hint}</p> : null}
        {trend ? <p className={cn("mt-1 text-xs font-medium", trend.positive ? "text-emerald-600" : "text-rose-600")}>{trend.label}</p> : null}
      </div>
      {Icon ? (
        <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tones[tone] || tones.brand)}>
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
    </div>
  );
  const cls = "block rounded-xl border border-slate-200/80 bg-white p-4 shadow-card sm:p-5";
  return href ? (
    <Link href={href} className={cn(cls, "transition hover:border-brand-200 hover:shadow-pop")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {Icon ? (
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <Icon className="h-6 w-6" />
        </span>
      ) : null}
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200/70", className)} />;
}

export function Avatar({ name, src, size = "md", className }) {
  const sizes = { sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm", lg: "h-12 w-12 text-base" };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name || ""} className={cn("shrink-0 rounded-full object-cover", sizes[size], className)} />;
  }
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700", sizes[size], className)} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function ProgressBar({ value, max, className }) {
  const unlimited = max === null || max === undefined || max < 0;
  const pct = unlimited ? 8 : Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  const tone = unlimited ? "bg-emerald-500" : pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-brand-500";
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Alert({ tone = "info", title, children, action, icon: Icon, className }) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    urgent: "border-orange-300 bg-orange-50 text-orange-900",
    danger: "border-rose-200 bg-rose-50 text-rose-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between", tones[tone] || tones.info, className)} role="status">
      <div className="flex items-start gap-3">
        {Icon ? <Icon className="mt-0.5 h-5 w-5 shrink-0" /> : null}
        <div className="text-sm">
          {title ? <p className="font-semibold">{title}</p> : null}
          {children ? <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function TableCard({ children, className, footer }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card", className)}>
      <div className="scrollbar-thin overflow-x-auto">{children}</div>
      {footer ? <div className="border-t border-slate-100 px-4 py-3">{footer}</div> : null}
    </div>
  );
}

export function KeyValue({ label, value, className }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-2 text-sm", className)}>
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}
