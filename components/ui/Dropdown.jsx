"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/utils/cn";

export default function Dropdown({ trigger, children, align = "right", className, panelClassName }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div onClick={() => setOpen((o) => !o)}>{typeof trigger === "function" ? trigger(open) : trigger}</div>
      {open ? (
        <div
          className={cn(
            "absolute z-40 mt-2 min-w-48 animate-fade-in rounded-xl border border-slate-200 bg-white p-1 shadow-pop",
            align === "right" ? "right-0" : "left-0",
            panelClassName,
          )}
          onClick={(e) => {
            if (e.target.closest("[data-close]")) setOpen(false);
          }}
          role="menu"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function DropdownItem({ href, onClick, icon: Icon, children, tone, disabled }) {
  const cls = cn(
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
    tone === "danger" ? "text-rose-600 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-100",
    disabled && "pointer-events-none opacity-40",
  );
  const content = (
    <>
      {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-70" /> : null}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls} data-close role="menuitem">
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} data-close role="menuitem" disabled={disabled}>
      {content}
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-slate-100" />;
}
