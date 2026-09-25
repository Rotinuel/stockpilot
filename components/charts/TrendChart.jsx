"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { AXIS_TEXT, GRID, SERIES } from "./palette";
import { compactNumber, niceMax, useWidth } from "./useWidth";

/**
 * Line/area chart over time with a snapping crosshair + tooltip.
 * @param {{data: object[], series: {key:string,label:string}[], currency?: string, height?: number, xKey?: string}} props
 */
export default function TrendChart({ data = [], series = [], currency = "NGN", height = 240, xKey = "date", money = true }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { top: 12, right: 12, bottom: 26, left: 48 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0))));
  const min = Math.min(0, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)));
  const range = max - min || 1;
  const x = (i) => pad.left + (data.length <= 1 ? w / 2 : (i / (data.length - 1)) * w);
  const y = (v) => pad.top + h - ((v - min) / range) * h;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + t * range);
  const fmt = (v) => (money ? formatMoney(v, currency) : Number(v).toLocaleString("en-NG"));
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(w / 70))));
  const shortDate = (s) => {
    const d = new Date(`${s}T12:00:00Z`);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - pad.left;
    const i = Math.round((px / Math.max(w, 1)) * (data.length - 1));
    setHover(Math.min(data.length - 1, Math.max(0, i)));
  };

  return (
    <div ref={ref} className="relative w-full">
      {series.length > 1 ? (
        <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
          {series.map((s, i) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full" style={{ background: SERIES[i] }} />
              {s.label}
            </span>
          ))}
        </div>
      ) : null}
      <svg width={width} height={height} role="img" aria-label={series.map((s) => s.label).join(" and ") + " over time"} onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="touch-pan-y select-none">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill={AXIS_TEXT} className="tabular-nums">
              {compactNumber(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <text key={d[xKey]} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} fontSize="10" fill={AXIS_TEXT}>
              {shortDate(d[xKey])}
            </text>
          ) : null,
        )}
        {series.map((s, si) => {
          const pts = data.map((d, i) => [x(i), y(Number(d[s.key]) || 0)]);
          if (!pts.length) return null;
          const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
          const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${y(Math.max(min, 0)).toFixed(1)} L${pts[0][0].toFixed(1)},${y(Math.max(min, 0)).toFixed(1)} Z`;
          return (
            <g key={s.key}>
              {si === 0 ? <path d={area} fill={SERIES[si]} opacity="0.1" /> : null}
              <path d={line} fill="none" stroke={SERIES[si]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        {hover !== null && data[hover] ? (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + h} stroke="#94a3b8" strokeWidth="1" />
            {series.map((s, si) => (
              <circle key={s.key} cx={x(hover)} cy={y(Number(data[hover][s.key]) || 0)} r="4.5" fill={SERIES[si]} stroke="#fff" strokeWidth="2" />
            ))}
          </g>
        ) : null}
      </svg>
      {hover !== null && data[hover] ? (
        <div
          className="pointer-events-none absolute top-6 z-10 min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-pop"
          style={{ left: Math.min(Math.max(x(hover) - 70, 0), width - 160) }}
        >
          <p className="mb-1 font-medium text-slate-500">{shortDate(data[hover][xKey])}</p>
          {series.map((s, si) => (
            <p key={s.key} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <span className="h-0.5 w-3 rounded-full" style={{ background: SERIES[si] }} />
                {s.label}
              </span>
              <strong className="text-slate-900 tabular-nums">{fmt(data[hover][s.key])}</strong>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
