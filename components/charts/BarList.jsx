"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { SERIES } from "./palette";

/** Horizontal ranked bars with the value at the tip (single series). */
export default function BarList({ items = [], valueKey = "value", labelKey = "label", currency = "NGN", money = true, sub }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...items.map((i) => Number(i[valueKey]) || 0));
  const fmt = (v) => (money ? formatMoney(v, currency) : Number(v).toLocaleString("en-NG"));
  return (
    <ul className="space-y-3">
      {items.map((item, idx) => {
        const v = Number(item[valueKey]) || 0;
        const pct = Math.max(2, (v / max) * 100);
        return (
          <li key={item.key || item[labelKey] || idx} onPointerEnter={() => setHover(idx)} onPointerLeave={() => setHover(null)} tabIndex={0} onFocus={() => setHover(idx)} onBlur={() => setHover(null)} className="outline-none">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-slate-700">{item[labelKey]}</span>
              <span className="shrink-0 font-medium text-slate-900 tabular-nums">{fmt(v)}</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100">
              <div className="h-full rounded-r-[4px] rounded-l-sm transition-opacity" style={{ width: `${pct}%`, background: SERIES[0], opacity: hover === null || hover === idx ? 1 : 0.55 }} />
            </div>
            {sub && hover === idx ? <p className="mt-1 text-xs text-slate-500">{sub(item)}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
