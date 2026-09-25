"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <TriangleAlert className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">An unexpected error occurred while loading this page. Your data is safe. Please try again.</p>
      {error?.digest ? <p className="mt-2 font-mono text-xs text-slate-400">Ref: {error.digest}</p> : null}
      <button type="button" onClick={() => reset()} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
        <RotateCcw className="h-4 w-4" /> Try again
      </button>
    </main>
  );
}
