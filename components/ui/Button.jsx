import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/utils/cn";

const VARIANTS = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300",
  secondary: "bg-slate-900 text-white shadow-sm hover:bg-slate-800 disabled:bg-slate-400",
  outline: "border border-slate-300 bg-white text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 disabled:text-slate-400",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-300",
  danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-700 disabled:bg-rose-300",
  "danger-outline": "border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 disabled:text-rose-300",
  success: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:bg-emerald-300",
  soft: "bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:text-brand-300",
};

const SIZES = {
  xs: "h-7 px-2 text-xs gap-1 rounded-md",
  sm: "h-8 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-12 px-5 text-base gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg",
  "icon-sm": "h-8 w-8 rounded-lg",
};

export function buttonClasses({ variant = "primary", size = "md", className } = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
    VARIANTS[variant] || VARIANTS.primary,
    SIZES[size] || SIZES.md,
    className,
  );
}

export default function Button({ href, variant, size, className, loading = false, disabled, children, icon: Icon, type = "button", ...props }) {
  const classes = buttonClasses({ variant, size, className });
  const content = (
    <>
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      {children}
    </>
  );
  if (href && !disabled && (href.startsWith("/api/") || href.startsWith("http") || props.download !== undefined)) {
    const { prefetch, ...rest } = props;
    return (
      <a href={href} className={classes} {...rest}>
        {content}
      </a>
    );
  }
  if (href && !disabled) {
    return (
      <Link href={href} className={classes} {...props}>
        {content}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  );
}
