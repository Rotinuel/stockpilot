import { CircleCheck } from "lucide-react";
import Logo from "@/components/layout/Logo";

export default function AuthLayout({ children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-4 py-8 sm:px-8 lg:px-16">
        <Logo />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
        <p className="text-center text-xs text-slate-400">© {new Date().getFullYear()} StockPilot</p>
      </div>
      <aside className="relative hidden overflow-hidden bg-linear-to-br from-brand-950 via-brand-800 to-brand-600 lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <h2 className="max-w-md text-3xl font-bold text-white">Know your stock. Know your numbers.</h2>
        <ul className="mt-8 space-y-4 text-brand-100">
          {["7-day free trial — no payment required", "POS, inventory, customers, suppliers & expenses", "Real profit reports: gross and net", "Staff roles with the right access for each person"].map((t) => (
            <li key={t} className="flex items-center gap-3">
              <CircleCheck className="h-5 w-5 text-emerald-300" /> {t}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
