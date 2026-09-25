import { ShieldAlert } from "lucide-react";
import Button from "@/components/ui/Button";

export default function AccessDenied({ message = "Your role doesn't have access to this page. Ask the business owner if you need it." }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
        <ShieldAlert className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-slate-900">Access restricted</h1>
      <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
      <Button href="/dashboard" variant="outline" className="mt-6">
        Back to dashboard
      </Button>
    </div>
  );
}
