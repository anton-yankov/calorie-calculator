"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { dayLabel, daysBetween } from "@/lib/day";
import type { WeightPoint } from "@/lib/weight-trend";

// Plot geometry in CSS pixels, matching DailyBars
const MARGIN = { top: 18, right: 10, bottom: 22, left: 40 };
const PLOT_H = 170;

const kg = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

/** Weight axis around the data: whole-kg-friendly steps, ~4 divisions, never from zero. */
function weightScale(values: number[]): { low: number; high: number; ticks: number[] } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const step = [0.5, 1, 2, 5, 10].find((s) => span / s <= 4) ?? 20;
  const low = Math.floor((min - step / 4) / step) * step;
  const high = Math.ceil((max + step / 4) / step) * step;
  const ticks: number[] = [];
  for (let v = low; v <= high + step / 2; v += step) ticks.push(Math.round(v * 10) / 10);
  return { low, high, ticks };
}

/**
 * Weigh-ins as dots placed by date, the smoothed trend as a line through them,
 * and the goal weight as a dashed line. Hover or tap for the nearest weigh-in;
 * the table below is the keyboard and screen-reader path to the same numbers.
 */
export function WeightChart({
  points,
  start,
  end,
  goalKg,
  trendColor,
  summary,
}: {
  /** Weigh-ins inside the range, oldest first */
  points: WeightPoint[];
  /** First and last day of the range (YYYY-MM-DD) */
  start: string;
  end: string;
  /** null when there's no goal weight (maintaining) */
  goalKg: number | null;
  trendColor: string;
  /** Spoken description of the chart for assistive tech */
  summary: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);

  // Measure the card so the chart is laid out in real pixels, as in DailyBars
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pinned) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setPinned(false);
        setActive(null);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [pinned]);

  const height = MARGIN.top + PLOT_H + MARGIN.bottom;
  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const span = Math.max(daysBetween(start, end), 1);
  const x = (day: string) => MARGIN.left + (daysBetween(start, day) / span) * plotW;
  const empty = points.length === 0;

  // With no weigh-ins nothing is drawn against the axis, so any scale will do
  const { low, high, ticks } = weightScale(
    empty
      ? [0]
      : [...points.flatMap((p) => [p.weightKg, p.trendKg]), ...(goalKg === null ? [] : [goalKg])],
  );
  const y = (v: number) => MARGIN.top + ((high - v) / (high - low)) * PLOT_H;

  const trendPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day).toFixed(1)} ${y(p.trendKg).toFixed(1)}`)
    .join(" ");
  const current = active !== null ? points[active] : undefined;

  /** The weigh-in closest to the pointer, so nobody has to land on a dot. */
  function nearest(clientX: number, svg: SVGSVGElement): number | null {
    if (empty) return null;
    const px = clientX - svg.getBoundingClientRect().left;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.day) - px) < Math.abs(x(points[best]!.day) - px)) best = i;
    });
    return best;
  }

  return (
    <section className="overflow-hidden rounded-panel border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pb-1 pt-3">
        <h2 className="text-sm font-semibold">Weight</h2>
        {!empty && (
          <span className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/45" aria-hidden />
              weigh-ins
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-0.5 w-3.5 rounded-full"
                style={{ background: trendColor }}
                aria-hidden
              />
              trend
            </span>
            {goalKg !== null && (
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 border-t border-dashed border-foreground" aria-hidden />
                goal
              </span>
            )}
          </span>
        )}
      </header>

      <div ref={wrapRef} className="relative">
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={summary}
            className="block touch-pan-y select-none"
            onPointerMove={(e) => {
              if (e.pointerType === "mouse" && !pinned)
                setActive(nearest(e.clientX, e.currentTarget));
            }}
            onPointerDown={(e) => {
              // Mice hover; touch and pen tap to pin a weigh-in
              if (e.pointerType === "mouse") return;
              const i = nearest(e.clientX, e.currentTarget);
              if (pinned && active === i) {
                setPinned(false);
                setActive(null);
              } else {
                setActive(i);
                setPinned(true);
              }
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse" && !pinned) setActive(null);
            }}
          >
            {!empty &&
              ticks.map((v) => (
                <g key={v}>
                  <line
                    x1={MARGIN.left}
                    x2={width - MARGIN.right}
                    y1={y(v)}
                    y2={y(v)}
                    stroke="var(--line)"
                    strokeWidth={1}
                  />
                  <text
                    x={MARGIN.left - 6}
                    y={y(v) + 3}
                    textAnchor="end"
                    fontSize={10}
                    fill="var(--muted)"
                    className="font-mono tabular-nums"
                  >
                    {kg(v)}
                  </text>
                </g>
              ))}

            {goalKg !== null && !empty && (
              <g>
                <line
                  x1={MARGIN.left}
                  x2={width - MARGIN.right}
                  y1={y(goalKg)}
                  y2={y(goalKg)}
                  stroke="var(--foreground)"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
                <text
                  x={width - MARGIN.right}
                  y={y(goalKg) - 4}
                  textAnchor="end"
                  fontSize={10}
                  fill="var(--muted)"
                  className="font-mono tabular-nums"
                >
                  goal {kg(goalKg)} kg
                </text>
              </g>
            )}

            {current && (
              <line
                x1={x(current.day)}
                x2={x(current.day)}
                y1={MARGIN.top}
                y2={MARGIN.top + PLOT_H}
                stroke="var(--line)"
                strokeWidth={1}
              />
            )}

            {points.map((p, i) => (
              <circle
                key={p.day}
                cx={x(p.day)}
                cy={y(p.weightKg)}
                r={active === i ? 4 : 2.5}
                fill="var(--foreground)"
                fillOpacity={active === i ? 1 : 0.45}
              />
            ))}

            {points.length > 1 && (
              <path
                d={trendPath}
                fill="none"
                stroke={trendColor}
                strokeWidth={2.25}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            <text
              x={MARGIN.left}
              y={height - 7}
              fontSize={10}
              fill="var(--muted)"
              className="font-mono"
            >
              {dayLabel(start)}
            </text>
            <text
              x={width - MARGIN.right}
              y={height - 7}
              textAnchor="end"
              fontSize={10}
              fill="var(--muted)"
              className="font-mono"
            >
              {dayLabel(end)}
            </text>

            {empty && (
              <text
                x={MARGIN.left + plotW / 2}
                y={MARGIN.top + PLOT_H / 2}
                textAnchor="middle"
                fontSize={13}
                fill="var(--muted)"
              >
                No weigh-ins in this range
              </text>
            )}
          </svg>
        )}

        {current && width > 0 && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 z-10 max-w-[70%] rounded-panel border border-line bg-surface-raised px-3 py-2 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            style={
              x(current.day) < width / 2
                ? { left: x(current.day) + 8 }
                : { right: width - x(current.day) + 8 }
            }
          >
            <div className="text-muted">{dayLabel(current.day)}</div>
            <div className="font-mono tabular-nums">
              <span className="text-sm font-bold text-foreground">{kg(current.weightKg)}</span>
              <span className="text-muted"> kg</span>
            </div>
            <div className="font-mono text-muted">trend {kg(current.trendKg)} kg</div>
          </div>
        )}
      </div>

      {!empty && (
        <details className="group border-t border-line">
          <summary className="cursor-pointer select-none px-4 py-2 text-xs font-semibold text-accent [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show as table</span>
            <span className="hidden group-open:inline">Hide table</span>
          </summary>
          <div className="max-h-72 overflow-y-auto border-t border-line">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.08em] text-muted">
                  <th className="px-4 py-2 text-left font-semibold">Day</th>
                  <th className="px-2 py-2 text-right font-semibold">kg</th>
                  <th className="py-2 pl-2 pr-4 text-right font-semibold">Trend</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs tabular-nums text-muted">
                {[...points].reverse().map((p) => (
                  <tr key={p.day} className="border-t border-line/60">
                    <td className="px-4 py-1.5 font-sans text-[13px] text-foreground">
                      {dayLabel(p.day)}
                    </td>
                    <td className="px-2 py-1.5 text-right">{kg(p.weightKg)}</td>
                    <td className="py-1.5 pl-2 pr-4 text-right">{kg(p.trendKg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
