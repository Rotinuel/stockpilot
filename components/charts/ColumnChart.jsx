"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { AXIS_TEXT, GRID, SERIES } from "./palette";
import { compactNumber, niceMax, useWidth } from "./useWidth";

/** Single-series columns (≤24px thick, 4px rounded cap) with per-column tooltip. */
export default function ColumnChart({ data = [], valueKey = "value", labelKey = "label", money = false, currency = "NGN", height = 220 }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { top: 12, right: 8, bottom: 24, left: 44 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0)));
  const band = w / Math.max(1, data.length);
  const barW = Math.min(24, Math.max(3, band - 2));
  const fmt = (v) => (money ? formatMoney(v, currency) : Number(v).toLocaleString("en-NG"));
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(w / 48))));

  return (
    <div ref={ref} className="relative w-full">
      <svg width={width} height={height} role="img" aria-label="Column chart" className="select-none">
        {[0, 0.5, 1].map((t) => {
          const yy = pad.top + h - t * h;
          return (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={yy} y2={yy} stroke={GRID} />
              <text x={pad.left - 8} y={yy} dy="0.32em" textAnchor="end" fontSize="10" fill={AXIS_TEXT}>
                {compactNumber(t * max)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const v = Number(d[valueKey]) || 0;
          const bh = Math.max(v > 0 ? 2 : 0, (v / max) * h);
          const cx = pad.left + band * i + band / 2;
          const x0 = cx - barW / 2;
          const y0 = pad.top + h - bh;
          const rr = Math.min(4, barW / 2, bh);
          const path = bh > 0 ? `M${x0},${pad.top + h} V${y0 + rr} Q${x0},${y0} ${x0 + rr},${y0} H${x0 + barW - rr} Q${x0 + barW},${y0} ${x0 + barW},${y0 + rr} V${pad.top + h} Z` : "";
          return (
            <g key={i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <rect x={pad.left + band * i} y={pad.top} width={band} height={h} fill="transparent" />
              {path ? <path d={path} fill={SERIES[0]} opacity={hover === null || hover === i ? 1 : 0.6} /> : null}
              {i % labelEvery === 0 ? (
                <text x={cx} y={height - 6} textAnchor="middle" fontSize="10" fill={AXIS_TEXT}>
                  {d[labelKey]}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] ? (
        <div className="pointer-events-none absolute top-2 z-10 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-pop" style={{ left: Math.min(Math.max(pad.left + band * hover - 40, 0), width - 130) }}>
          <p className="text-slate-500">{data[hover][labelKey]}</p>
          <p className="font-semibold text-slate-900 tabular-nums">{fmt(data[hover][valueKey])}</p>
        </div>
      ) : null}
    </div>
  );
}
