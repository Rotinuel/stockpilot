"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Building2, Users, Repeat, CreditCard, Layers, History, Settings, Menu, X, LogOut, ShieldCheck } from "lucide-react";
import { LogoMark } from "@/components/layout/Logo";
import { apiFetch } from "@/hooks/useApi";
import { cn } from "@/utils/cn";

const NAV = [
  { href: "/super-admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/super-admin/tenants", label: "Businesses", icon: Building2 },
  { href: "/super-admin/users", label: "Users", icon: Users },
  { href: "/super-admin/subscriptions", label: "Subscriptions", icon: Repeat },
  { href: "/super-admin/payments", label: "Payments", icon: CreditCard },
  { href: "/super-admin/plans", label: "Plans & pricing", icon: Layers },
  { href: "/super-admin/audit-logs", label: "Audit logs", icon: History },
  { href: "/super-admin/settings", label: "Global settings", icon: Settings },
];

function Nav({ onNavigate }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5 px-3 py-4">
      {NAV.map((n) => {
        const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} onClick={onNavigate} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium", active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white")}>
            <n.icon className={cn("h-4 w-4", active ? "text-amber-300" : "text-slate-400")} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminShell({ user, children }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => setOpen(false), [pathname]);
  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };
  const brand = (
    <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-4">
      <LogoMark />
      <div>
        <p className="text-sm font-semibold text-white">StockPilot</p>
        <p className="flex items-center gap-1 text-xs text-amber-300">
          <ShieldCheck className="h-3 w-3" /> Super Admin
        </p>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-slate-950 lg:block">
        {brand}
        <Nav />
      </aside>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-64 animate-slide-in bg-slate-950">
            {brand}
            <Nav onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex-1" />
          <span className="hidden text-sm text-slate-600 sm:block">{user.email}</span>
          <button type="button" onClick={logout} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
