import { WifiOff } from "lucide-react";

export const metadata = { title: "You're offline", robots: { index: false } };

export default function OfflinePage() {
  // Plain <a> links: a full page load lets the service worker answer from its saved copies.
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
        <WifiOff className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-xl font-semibold text-slate-900">You're offline</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        This page hasn't been saved on this device yet — pages you've opened while online are available offline. The POS keeps working without internet — sales are stored on this device and sent automatically when you're back online.
      </p>
      <div className="mt-6 flex gap-3">
        <a href="/pos" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Open POS
        </a>
        <a href="/dashboard" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Dashboard
        </a>
      </div>
    </main>
  );
}
