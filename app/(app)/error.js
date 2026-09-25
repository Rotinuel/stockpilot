"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

export default function AppError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <TriangleAlert className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-slate-900">We couldn't load this page</h1>
      <p className="mt-1 max-w-md text-sm text-slate-500">Something went wrong on our side. Your data is safe — please try again.</p>
      <button type="button" onClick={() => reset()} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
        <RotateCcw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}
