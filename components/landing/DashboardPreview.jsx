// Static illustration of the product UI (sample figures, clearly a preview).
export default function DashboardPreview() {
  const bars = [38, 52, 44, 61, 58, 72, 66, 80, 74, 88, 70, 92];
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-linear-to-tr from-brand-200/60 via-violet-100/50 to-sky-100/60 blur-2xl" aria-hidden />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop">
        <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          <span className="ml-3 text-xs text-slate-400">app.stockpilot.ng/dashboard · sample data</span>
        </div>
        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-4">
          {[
            ["Today's sales", "₦184,500", "42 transactions"],
            ["Gross profit", "₦46,320", "25.1% margin"],
            ["Low stock", "8 items", "Reorder soon"],
            ["Owed to you", "₦62,000", "5 customers"],
          ].map(([l, v, h]) => (
            <div key={l} className="rounded-xl border border-slate-100 p-4">
              <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{l}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{v}</p>
              <p className="text-xs text-slate-500">{h}</p>
            </div>
          ))}
          <div className="rounded-xl border border-slate-100 p-4 lg:col-span-3">
            <p className="text-sm font-semibold text-slate-800">Sales this month</p>
            <div className="mt-4 flex h-36 items-end gap-2">
              {bars.map((b, i) => (
                <div key={i} className="flex-1 rounded-t-[4px] bg-[#2a78d6]" style={{ height: `${b}%`, maxWidth: 24 }} />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 p-4">
            <p className="text-sm font-semibold text-slate-800">Top sellers</p>
            <ul className="mt-3 space-y-2.5 text-xs">
              {[
                ["Indomie Chicken 70g", 92],
                ["Peak Milk 400g", 74],
                ["Coca-Cola 50cl", 63],
                ["Golden Penny Spaghetti", 48],
              ].map(([n, p]) => (
                <li key={n}>
                  <div className="flex justify-between text-slate-600">
                    <span className="truncate">{n}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${p}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
