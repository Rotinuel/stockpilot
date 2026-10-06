"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut, Settings, CreditCard, UserRound, Lock, Sparkles, Download } from "lucide-react";
import { NAV_SECTIONS } from "./nav";
import { LogoMark } from "./Logo";
import NotificationBell from "./NotificationBell";
import OfflineManager from "@/components/offline/OfflineManager";
import InstallPrompt, { InstallHelpModal, useInstallApp } from "@/components/offline/InstallApp";
import { useConfirm } from "@/components/ui/Confirm";
import { clearOfflineData, listOutbox } from "@/lib/offline/store";
import Dropdown, { DropdownItem, DropdownSeparator } from "@/components/ui/Dropdown";
import { Avatar } from "@/components/ui/Misc";
import { cn } from "@/utils/cn";
import { ROLE_LABELS } from "@/lib/constants";
import { apiFetch } from "@/hooks/useApi";

function SidebarContent({ session, permissions, badges, onNavigate }) {
  const pathname = usePathname();
  const perms = new Set(permissions);
  const features = session.plan?.features || {};
  const access = session.access;
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-800/60 px-4">
        {session.tenant.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.tenant.logo} alt="" className="h-8 w-8 rounded-lg bg-white object-cover" />
        ) : (
          <LogoMark />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{session.tenant.businessName}</p>
          <p className="truncate text-xs text-slate-400">{session.plan?.name || "Free Trial"} plan</p>
        </div>
      </div>
      <nav className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="App">
        {NAV_SECTIONS.map((section, i) => {
          const items = section.items.filter((it) => !it.permission || perms.has(it.permission));
          if (!items.length) return null;
          return (
            <div key={section.label || i}>
              {section.label ? <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{section.label}</p> : null}
              <ul className="space-y-0.5">
                {items.map((it) => {
                  const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
                  const locked = it.feature && !features[it.feature];
                  const badge = it.badgeKey ? badges?.[it.badgeKey] : 0;
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        onClick={onNavigate}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        <it.icon className={cn("h-4.5 w-4.5 shrink-0", active ? "text-brand-300" : "text-slate-400 group-hover:text-slate-200")} />
                        <span className="flex-1 truncate">{it.label}</span>
                        {locked ? <Lock className="h-3.5 w-3.5 text-slate-500" aria-label="Upgrade required" /> : null}
                        {badge ? <span className="rounded-full bg-amber-400/90 px-1.5 text-[10px] font-bold text-amber-950">{badge}</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      {access?.state === "trialing" && perms.has("billing:view") ? (
        <div className="m-3 rounded-xl bg-linear-to-br from-brand-600 to-violet-600 p-3.5 text-white">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" /> Free trial
          </p>
          <p className="mt-1 text-sm font-semibold">
            {access.daysLeft} day{access.daysLeft === 1 ? "" : "s"} left
          </p>
          <Link href="/billing" onClick={onNavigate} className="mt-2.5 block rounded-lg bg-white/15 py-1.5 text-center text-xs font-semibold hover:bg-white/25">
            Choose a plan
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export default function AppShell({ session, permissions, badges, children }) {
  const installApp = useInstallApp();
  const [installHelp, setInstallHelp] = useState(false);
  const onInstallClick = async () => {
    if (installApp.canPrompt) await installApp.install();
    else setInstallHelp(true);
  };
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const confirm = useConfirm();
  useEffect(() => setOpen(false), [pathname]);

  const logout = async () => {
    const unsynced = (await listOutbox(session.tenant.id, session.user.id)).length;
    if (unsynced) {
      const ok = await confirm({
        title: "Unsynced offline sales",
        message: `${unsynced} sale${unsynced === 1 ? " hasn't" : "s haven't"} been sent to the server yet. Signing out now will delete ${unsynced === 1 ? "it" : "them"} from this device. Connect to the internet first to sync.`,
        confirmLabel: "Sign out anyway",
        tone: "danger",
      });
      if (!ok) return;
    }
    await clearOfflineData();
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

  const access = session.access;
  const pillTone =
    access?.state === "trialing"
      ? access.severity === "urgent"
        ? "bg-rose-50 text-rose-700 ring-rose-200"
        : access.severity === "warning"
          ? "bg-amber-50 text-amber-800 ring-amber-200"
          : "bg-brand-50 text-brand-700 ring-brand-200"
      : "bg-rose-50 text-rose-700 ring-rose-200";

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-slate-900 lg:block">
        <SidebarContent session={session} permissions={permissions} badges={badges} />
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 animate-fade-in bg-slate-900/60" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-72 max-w-[85vw] animate-slide-in bg-slate-900 shadow-2xl">
            <button type="button" onClick={() => setOpen(false)} className="absolute top-4 -right-11 rounded-lg bg-slate-900 p-2 text-white" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            <SidebarContent session={session} permissions={permissions} badges={badges} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setOpen(true)} className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800 lg:hidden">{session.tenant.businessName}</p>
          </div>
          {access && access.state !== "active" && access.message && permissions.includes("billing:view") ? (
            <Link href="/billing" className={cn("hidden items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 sm:inline-flex", pillTone)}>
              {access.state === "trialing" ? `Trial: ${access.daysLeft} day${access.daysLeft === 1 ? "" : "s"} left` : access.state === "cancelled" ? "Cancelled" : access.state === "past_due" ? "Payment due" : "Subscription inactive"}
            </Link>
          ) : null}
          <OfflineManager tenantId={session.tenant.id} userId={session.user.id} canPos={permissions.includes("pos:use") && Boolean(session.access?.canWrite)} />
          <NotificationBell />
          <Dropdown
            trigger={
              <button type="button" className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-100" aria-label="Account menu">
                <Avatar name={session.user.name} src={session.user.avatar} size="sm" />
                <span className="hidden text-left sm:block">
                  <span className="block max-w-32 truncate text-sm font-medium text-slate-800">{session.user.name}</span>
                  <span className="block text-xs text-slate-500">{ROLE_LABELS[session.user.role]}</span>
                </span>
              </button>
            }
          >
            <div className="px-3 py-2">
              <p className="truncate text-sm font-medium text-slate-900">{session.user.name}</p>
              <p className="truncate text-xs text-slate-500">{session.user.email}</p>
            </div>
            <DropdownSeparator />
            <DropdownItem href="/settings?tab=account" icon={UserRound}>
              My account
            </DropdownItem>
            {permissions.includes("settings:business") ? (
              <DropdownItem href="/settings" icon={Settings}>
                Business settings
              </DropdownItem>
            ) : null}
            {permissions.includes("billing:view") ? (
              <DropdownItem href="/billing" icon={CreditCard}>
                Billing
              </DropdownItem>
            ) : null}
            {!installApp.installed ? (
              <DropdownItem onClick={onInstallClick} icon={Download}>
                Install app
              </DropdownItem>
            ) : null}
            <DropdownSeparator />
            <DropdownItem onClick={logout} icon={LogOut} tone="danger">
              Sign out
            </DropdownItem>
          </Dropdown>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        <InstallPrompt />
        {installHelp ? <InstallHelpModal platform={installApp.platform} onClose={() => setInstallHelp(false)} /> : null}
      </div>
    </div>
  );
}
