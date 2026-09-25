"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { OTHER, SERIES } from "./palette";

/**
 * Donut with a legend that carries every value (identity never by color alone).
 * More than 6 categories fold into "Other".
 */
export default function DonutChart({ items = [], currency = "NGN", money = true, size = 168, centerLabel = "Total" }) {
  const [hover, setHover] = useState(null);
  const sorted = [...items].filter((i) => Number(i.value) > 0).sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6).reduce((s, i) => s + Number(i.value), 0);
  const data = rest > 0 ? [...top, { label: "Other", value: rest, other: true }] : top;
  const total = data.reduce((s, i) => s + Number(i.value), 0);
  const fmt = (v) => (money ? formatMoney(v, currency) : Number(v).toLocaleString("en-NG"));
  const r = size / 2;
  const stroke = 22;
  const radius = r - stroke / 2 - 2;
  const circ = 2 * Math.PI * radius;
  const gap = data.length > 1 ? 2 : 0;
  let offset = 0;

  if (!total) return <p className="py-8 text-center text-sm text-slate-500">No data for this period yet.</p>;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Breakdown chart" className="-rotate-90">
          {data.map((d, i) => {
            const len = (Number(d.value) / total) * circ;
            const seg = (
              <circle
                key={d.label}
                cx={r}
                cy={r}
                r={radius}
                fill="none"
                stroke={d.other ? OTHER : SERIES[i]}
                strokeWidth={hover === i ? stroke + 4 : stroke}
                strokeDasharray={`${Math.max(0, len - gap)} ${circ}`}
                strokeDashoffset={-offset}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                className="cursor-pointer transition-[stroke-width]"
              />
            );
            offset += len;
            return seg;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] text-slate-500">{hover !== null ? data[hover].label : centerLabel}</span>
          <span className="max-w-[70%] truncate text-sm font-semibold text-slate-900">{fmt(hover !== null ? data[hover].value : total)}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className={`flex items-center justify-between gap-3 rounded-md px-1.5 py-0.5 ${hover === i ? "bg-slate-50" : ""}`} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <span className="inline-flex min-w-0 items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.other ? OTHER : SERIES[i] }} />
              <span className="truncate">{d.label}</span>
            </span>
            <span className="shrink-0 text-slate-900 tabular-nums">
              {fmt(d.value)} <span className="text-xs text-slate-400">{Math.round((d.value / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
