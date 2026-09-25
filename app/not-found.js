import Link from "next/link";
import { LogoMark } from "@/components/layout/Logo";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <LogoMark className="h-12 w-12" />
      <p className="mt-6 text-sm font-semibold text-brand-600">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">We couldn't find that page</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">The link may be broken, or the item may have been removed or belong to another account.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/dashboard" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Go to dashboard
        </Link>
        <Link href="/" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Home
        </Link>
      </div>
    </main>
  );
}
