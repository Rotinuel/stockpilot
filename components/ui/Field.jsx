import { cn } from "@/utils/cn";

export function Label({ htmlFor, children, required, className }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 block text-sm font-medium text-slate-700", className)}>
      {children}
      {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
    </label>
  );
}

export function Field({ label, htmlFor, error, hint, required, className, children }) {
  return (
    <div className={className}>
      {label ? (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-rose-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, error, prefix, ...props }) {
  if (prefix) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-slate-500">{prefix}</span>
        <input className={cn("field-input pl-8", className)} aria-invalid={error ? "true" : undefined} {...props} />
      </div>
    );
  }
  return <input className={cn("field-input", className)} aria-invalid={error ? "true" : undefined} {...props} />;
}

export function Select({ className, error, children, ...props }) {
  return (
    <select className={cn("field-input pr-8", className)} aria-invalid={error ? "true" : undefined} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, error, rows = 3, ...props }) {
  return <textarea rows={rows} className={cn("field-input", className)} aria-invalid={error ? "true" : undefined} {...props} />;
}

export function Checkbox({ label, description, className, ...props }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3", className)}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600" {...props} />
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description ? <span className="block text-xs text-slate-500">{description}</span> : null}
      </span>
    </label>
  );
}
