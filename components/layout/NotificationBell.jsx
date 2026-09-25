"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import { apiFetch } from "@/hooks/useApi";
import { timeAgo } from "@/utils/format";
import { cn } from "@/utils/cn";

const DOT = { info: "bg-sky-500", success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-rose-500" };

export default function NotificationBell() {
  const router = useRouter();
  const [data, setData] = useState({ unread: 0, items: [] });

  const load = useCallback(async () => {
    try {
      setData(await apiFetch("/api/notifications?limit=8"));
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const markAll = async () => {
    await apiFetch("/api/notifications/read", { method: "POST", body: {} }).catch(() => {});
    load();
  };

  const open = async (n) => {
    if (!n.read) await apiFetch("/api/notifications/read", { method: "POST", body: { ids: [n.id] } }).catch(() => {});
    load();
    if (n.link) router.push(n.link);
  };

  return (
    <Dropdown
      panelClassName="w-80 max-w-[calc(100vw-2rem)] p-0"
      trigger={
        <button type="button" className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label={`Notifications${data.unread ? ` (${data.unread} unread)` : ""}`}>
          <Bell className="h-5 w-5" />
          {data.unread ? <span className="absolute top-1 right-1 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[10px] leading-4 font-bold text-white">{data.unread > 9 ? "9+" : data.unread}</span> : null}
        </button>
      }
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Notifications</p>
        {data.unread ? (
          <button type="button" onClick={markAll} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        ) : null}
      </div>
      <ul className="max-h-96 overflow-y-auto">
        {data.items.length ? (
          data.items.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => open(n)} data-close className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50", !n.read && "bg-brand-50/40")}>
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-slate-200" : DOT[n.severity] || DOT.info)} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900">{n.title}</span>
                  {n.message ? <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">{n.message}</span> : null}
                  <span className="mt-1 block text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                </span>
              </button>
            </li>
          ))
        ) : (
          <li className="px-4 py-8 text-center text-sm text-slate-500">You're all caught up.</li>
        )}
      </ul>
      <Link href="/notifications" data-close className="block border-t border-slate-100 px-4 py-2.5 text-center text-xs font-medium text-slate-600 hover:bg-slate-50">
        View all notifications
      </Link>
    </Dropdown>
  );
}
