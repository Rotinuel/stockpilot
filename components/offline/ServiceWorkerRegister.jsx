"use client";

import { useEffect } from "react";
import { swEnabled, swUrl, warmOffline } from "@/lib/offline/sw-client";

// Registers /sw.js (on by default; set NEXT_PUBLIC_DISABLE_OFFLINE=true to disable).
// In development it is registered as /sw.js?dev=1, which always prefers the
// network for code so hot reloading is never served stale files.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (!swEnabled()) {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => null);
      return;
    }
    const register = async () => {
      try {
        await navigator.serviceWorker.register(swUrl(), { scope: "/" });
        // Save the current page + its files so a reload works offline.
        await warmOffline([location.pathname], { refresh: false });
      } catch (err) {
        console.warn("[sw] registration failed", err);
      }
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
