"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Share, SquarePlus, X, WifiOff, Zap, MonitorSmartphone } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

const DISMISS_KEY = "sp:install-dismissed";
const DISMISS_DAYS = 14;

// Chrome/Edge/Android fire `beforeinstallprompt` (sometimes before React loads, so the root
// layout stashes it on window.__spInstallEvent — see INSTALL_CAPTURE_SCRIPT). Safari (iPhone/iPad,
// Mac) has no prompt API: users add the app from the Share menu, so we show instructions instead.
export const INSTALL_CAPTURE_SCRIPT = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__spInstallEvent=e;window.dispatchEvent(new Event("sp:installable"));});window.addEventListener("appinstalled",function(){window.__spInstallEvent=null;window.__spInstalled=true;window.dispatchEvent(new Event("sp:installed"));});`;

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || window.matchMedia?.("(display-mode: window-controls-overlay)").matches || window.navigator.standalone === true;
}

function platform() {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  const iOS = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (iOS) return "ios";
  if (/safari/i.test(ua) && !/chrome|chromium|crios|edg|android/i.test(ua)) return "mac-safari";
  return "other";
}

function readDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at && Date.now() - at < DISMISS_DAYS * 86400000;
  } catch {
    return false;
  }
}

/** { canPrompt, installed, platform, install(), } */
export function useInstallApp() {
  const [event, setEvent] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [plat, setPlat] = useState("other");

  useEffect(() => {
    setPlat(platform());
    setInstalled(isStandalone() || Boolean(window.__spInstalled));
    if (window.__spInstallEvent) setEvent(window.__spInstallEvent);
    const onAvailable = () => setEvent(window.__spInstallEvent || null);
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };
    // Also listen directly in case the inline capture script didn't run.
    const onBip = (e) => {
      e.preventDefault();
      window.__spInstallEvent = e;
      setEvent(e);
    };
    window.addEventListener("sp:installable", onAvailable);
    window.addEventListener("sp:installed", onInstalled);
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("sp:installable", onAvailable);
      window.removeEventListener("sp:installed", onInstalled);
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const e = event || window.__spInstallEvent;
    if (!e) return "unavailable";
    e.prompt();
    const choice = await e.userChoice.catch(() => ({ outcome: "dismissed" }));
    window.__spInstallEvent = null; // a prompt event can only be used once
    setEvent(null);
    if (choice?.outcome === "accepted") setInstalled(true);
    return choice?.outcome || "dismissed";
  }, [event]);

  return { canPrompt: Boolean(event), installed, platform: plat, install };
}

const PERKS = [
  { icon: Zap, text: "Opens straight to your shop — no browser tabs" },
  { icon: WifiOff, text: "Keep selling when the internet is down" },
  { icon: MonitorSmartphone, text: "Works on phone, tablet and computer" },
];

function Step({ n, children }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{n}</span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

function AppleSteps() {
  return (
    <ol className="space-y-2.5 text-sm text-slate-700">
      <Step n={1}>
        Tap the <Share className="-mt-0.5 inline h-4 w-4 text-brand-600" aria-label="Share" /> <strong>Share</strong> button in the browser bar.
      </Step>
      <Step n={2}>
        Choose <SquarePlus className="-mt-0.5 inline h-4 w-4 text-brand-600" aria-hidden /> <strong>Add to Home Screen</strong> (on a Mac: <strong>Add to Dock</strong>).
      </Step>
      <Step n={3}>
        Tap <strong>Add</strong>. StockPilot appears with your other apps.
      </Step>
    </ol>
  );
}

/** Help dialog: used by the banner on Safari and by the "Install app" menu item everywhere. */
export function InstallHelpModal({ onClose, platform: plat }) {
  return (
    <Modal open onClose={onClose} title="Install StockPilot" description="Use StockPilot like a normal app on this device.">
      <ul className="mb-5 space-y-2">
        {PERKS.map((p) => (
          <li key={p.text} className="flex items-center gap-2 text-sm text-slate-600">
            <p.icon className="h-4 w-4 shrink-0 text-emerald-600" /> {p.text}
          </li>
        ))}
      </ul>
      {plat === "ios" || plat === "mac-safari" ? (
        <AppleSteps />
      ) : (
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            <strong>Chrome or Edge (computer):</strong> click the install icon <Download className="inline h-4 w-4 text-brand-600" aria-hidden /> at the right of the address bar, or open the browser menu (⋮) → <strong>Install StockPilot</strong> / <strong>Apps → Install this site as an app</strong>.
          </p>
          <p>
            <strong>Android:</strong> open the browser menu (⋮) → <strong>Install app</strong> or <strong>Add to Home screen</strong>.
          </p>
          <p className="text-xs text-slate-500">Firefox on computers can&apos;t install web apps — use Chrome or Edge.</p>
        </div>
      )}
    </Modal>
  );
}

/**
 * Friendly install card shown a few seconds after sign-in (once every 14 days at most,
 * never inside the installed app).
 */
export default function InstallPrompt({ delayMs = 4000 }) {
  const { canPrompt, installed, platform: plat, install } = useInstallApp();
  const [visible, setVisible] = useState(false);
  const [help, setHelp] = useState(false);
  const apple = plat === "ios"; // Mac Safari users can still use the menu item

  useEffect(() => {
    if (installed || readDismissed()) return setVisible(false);
    if (!canPrompt && !apple) return;
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [canPrompt, installed, apple, delayMs]);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setVisible(false);
  };

  const onInstall = async () => {
    if (apple) return setHelp(true);
    const outcome = await install();
    if (outcome === "accepted") setVisible(false);
    else if (outcome === "dismissed") dismiss();
  };

  if (installed) return null;
  return (
    <>
      {visible ? (
        <div
          role="dialog"
          aria-label="Install StockPilot"
          className="no-print fixed inset-x-3 bottom-24 z-40 animate-slide-up rounded-2xl border border-slate-200 bg-white p-4 shadow-pop sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
        >
          <button type="button" onClick={dismiss} className="absolute top-3 right-3 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Not now">
            <X className="h-4 w-4" />
          </button>
          <div className="flex gap-3 pr-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl" />
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">Install the StockPilot app</p>
              <p className="mt-0.5 text-sm text-slate-600">Faster to open, and the POS keeps working when the internet is down.</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button className="flex-1" icon={Download} onClick={onInstall}>
              {apple ? "Show me how" : "Install app"}
            </Button>
            <Button variant="ghost" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </div>
      ) : null}
      {help ? <InstallHelpModal platform={plat} onClose={() => setHelp(false)} /> : null}
    </>
  );
}
