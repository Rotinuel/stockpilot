"use client";

import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import Button from "@/components/ui/Button";
import { apiFetch, useAction } from "@/hooks/useApi";
import { timeAgo } from "@/utils/format";
import { cn } from "@/utils/cn";

const DOT = { info: "bg-sky-500", success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-rose-500" };

export default function NotificationList({ items, unread }) {
  const router = useRouter();
  const { run, loading } = useAction();
  const open = async (n) => {
    if (!n.read) await apiFetch("/api/notifications/read", { method: "POST", body: { ids: [n.id] } }).catch(() => {});
    if (n.link) router.push(n.link);
    else router.refresh();
  };
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <p className="text-sm text-slate-600">{unread} unread</p>
        <Button size="sm" variant="ghost" icon={CheckCheck} loading={loading} disabled={!unread} onClick={() => run(() => apiFetch("/api/notifications/read", { method: "POST", body: {} }), { refresh: true })}>
          Mark all as read
        </Button>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.length ? (
          items.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => open(n)} className={cn("flex w-full gap-3 px-5 py-4 text-left hover:bg-slate-50", !n.read && "bg-brand-50/40")}>
                <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", n.read ? "bg-slate-200" : DOT[n.severity] || DOT.info)} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-900">{n.title}</span>
                  {n.message ? <span className="mt-0.5 block text-sm text-slate-600">{n.message}</span> : null}
                </span>
                <span className="shrink-0 text-xs text-slate-400">{timeAgo(n.createdAt)}</span>
              </button>
            </li>
          ))
        ) : (
          <li className="px-5 py-12 text-center text-sm text-slate-500">No notifications yet.</li>
        )}
      </ul>
    </div>
  );
}
