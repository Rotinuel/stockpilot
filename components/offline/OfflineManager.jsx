"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WifiOff, CloudUpload, TriangleAlert } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { OUTBOX_EVENT, listOutbox, saveCatalog, syncOutbox } from "@/lib/offline/store";
import { warmOffline } from "@/lib/offline/sw-client";
import { apiFetch } from "@/hooks/useApi";
import { cn } from "@/utils/cn";

// Reachability: the browser can say "online" while the server can't be reached (router
// with no internet, server stopped…). apiFetch/sync report failed requests with the
// "sp:unreachable" event; we then treat the app as offline and probe /api/health every
// 10 s until the server answers again.
const UNREACHABLE_EVENT = "sp:unreachable";
let reachable = true;
let probe = null;
const listeners = new Set();
function setReachable(value) {
  if (reachable === value) return;
  reachable = value;
  listeners.forEach((fn) => fn());
  if (!value && !probe) {
    probe = setInterval(async () => {
      if (!navigator.onLine) return;
      try {
        await fetch("/api/health", { cache: "no-store" }); // any HTTP answer means the server is back
        clearInterval(probe);
        probe = null;
        setReachable(true);
      } catch {}
    }, 10_000);
  }
}
if (typeof window !== "undefined") {
  window.addEventListener(UNREACHABLE_EVENT, () => setReachable(false));
  window.addEventListener("online", () => setReachable(true));
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine && reachable);
    update();
    listeners.add(update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      listeners.delete(update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

const PREPARE_EVERY_MS = 15 * 60 * 1000;

/**
 * Get this device ready for offline use while online: save the POS/dashboard pages
 * (via the service worker) and the product/customer catalogue (IndexedDB).
 */
async function prepareOffline({ tenantId, userId, canPos }) {
  const key = `sp:offline-ready:${tenantId}:${userId}`;
  try {
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < PREPARE_EVERY_MS) return;
    localStorage.setItem(key, String(Date.now()));
  } catch {}
  const pages = ["/dashboard", "/sales", ...(canPos ? ["/pos"] : [])];
  if (!pages.includes(location.pathname)) pages.push(location.pathname);
  await warmOffline(pages);
  if (canPos) {
    try {
      const fresh = await apiFetch("/api/pos/catalog");
      await saveCatalog(tenantId, fresh.locationId, fresh);
    } catch {}
  }
}

export default function OfflineManager({ tenantId, userId, canPos = false }) {
  const online = useOnline();
  const toast = useToast();
  const router = useRouter();
  const [counts, setCounts] = useState({ pending: 0, failed: 0 });
  const syncing = useRef(false);

  const refresh = useCallback(async () => {
    const items = await listOutbox(tenantId, userId);
    setCounts({ pending: items.filter((i) => i.status === "pending").length, failed: items.filter((i) => i.status === "failed").length });
    return items;
  }, [tenantId, userId]);

  const sync = useCallback(async () => {
    if (syncing.current || !navigator.onLine || !reachable) return;
    const items = await refresh();
    if (!items.some((i) => i.status === "pending")) return;
    syncing.current = true;
    try {
      const r = await syncOutbox(tenantId, userId);
      if (r.synced) {
        toast.success(`${r.synced} offline sale${r.synced === 1 ? "" : "s"} synced`, "Stock and reports are up to date.");
        router.refresh();
      }
      if (r.failed) toast.warning("Some offline sales need attention", "Open the POS to review them.");
    } finally {
      syncing.current = false;
      refresh();
    }
  }, [tenantId, userId, toast, router, refresh]);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(OUTBOX_EVENT, onChange);
    return () => window.removeEventListener(OUTBOX_EVENT, onChange);
  }, [refresh]);

  useEffect(() => {
    if (!online) return;
    const t = setTimeout(() => prepareOffline({ tenantId, userId, canPos }), 1500);
    return () => clearTimeout(t);
  }, [online, tenantId, userId, canPos]);

  useEffect(() => {
    if (online) sync();
    const t = setInterval(() => navigator.onLine && reachable && sync(), 30_000);
    return () => clearInterval(t);
  }, [online, sync]);

  if (online && !counts.pending && !counts.failed) return null;
  return (
    <Link
      href="/pos#offline-sales"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1",
        !online ? "bg-slate-900 text-white ring-slate-900" : counts.failed ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-amber-50 text-amber-800 ring-amber-200",
      )}
      title="Sales recorded offline are sent automatically when you're back online"
    >
      {!online ? <WifiOff className="h-3.5 w-3.5" /> : counts.failed ? <TriangleAlert className="h-3.5 w-3.5" /> : <CloudUpload className="h-3.5 w-3.5" />}
      {!online ? "Offline" : "Syncing"}
      {counts.pending ? ` · ${counts.pending} to sync` : ""}
      {counts.failed ? ` · ${counts.failed} failed` : ""}
    </Link>
  );
}
