"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { dayKey, weekStart } from "@/lib/day";

export interface BarDatum {
  key: string;
  /** Tooltip heading, e.g. "Thu 28.08 · 3 meals" */
  label: string;
  /** Axis and table label */
  short: string;
  /** null = nothing logged: an empty slot, never a zero bar */
  value: number | null;
  /** Second tooltip line, e.g. "148 g protein" */
  detail: string;
  /** Still accumulating — drawn outlined, excluded from the average line */
  partial: boolean;
}

// Plot geometry in CSS pixels; the SVG is sized to the card, so text stays crisp
const MARGIN = { top: 18, right: 10, bottom: 22, left: 40 };
const PLOT_H = 170;
const MAX_BAR_W = 24;
const GAP = 2;

/** Round axis ticks: a 1/2/2.5/5 step giving ~3 divisions up to a ceiling above `max`. */
function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const rough = max / 3;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? rough;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return { top, ticks };
}

const tickLabel = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(Math.round(v));

/** Bar with a rounded top and a square base at the baseline. */
function barPath(x: number, top: number, bottom: number, w: number): string {
  const h = bottom - top;
  const r = Math.min(4, w / 2, h);
  return `M${x} ${bottom} V${top + r} a${r} ${r} 0 0 1 ${r} -${r} h${w - 2 * r} a${r} ${r} 0 0 1 ${r} ${r} V${bottom} Z`;
}

const signed = (n: number) => (n >= 0 ? `+${Math.round(n)}` : `−${Math.round(-n)}`);

interface TrendSegment {
  x1: number;
  x2: number;
  y: number;
  /** A one-day average has too little evidence to present as a settled trend. */
  provisional: boolean;
}

/**
 * Column chart of one measure per day (or per week): bars in the accent hue,
 * the goal as a labeled ink hairline, and the average completed logged day as
 * a horizontal segment for each Monday-to-Sunday week.
 * Hover or tap a slot for its values; the details table below is the
 * keyboard and screen-reader path to the same numbers.
 */
export function DailyBars({
  title,
  unit,
  data,
  goal,
  mode,
  summary,
}: {
  title: string;
  unit: string;
  data: BarDatum[];
  goal: number | null;
  mode: "day" | "week";
  /** Spoken description of the chart for assistive tech */
  summary: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);

  // Measure the card so bars are laid out in real pixels (a scaled viewBox
  // would blur the axis text and stretch the stroke widths)
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

  // A pinned (tapped) tooltip goes away on a tap anywhere outside the chart
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
  const n = data.length;
  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const pitch = n ? plotW / n : 0;
  const barW = Math.max(1.5, Math.min(MAX_BAR_W, pitch - GAP));
  const baseline = MARGIN.top + PLOT_H;

  const values = data.map((d) => d.value).filter((v): v is number => v !== null);
  const { top, ticks } = niceScale(Math.max(0, ...values, goal ?? 0));
  const y = (v: number) => baseline - (v / top) * PLOT_H;
  const cx = (i: number) => MARGIN.left + i * pitch + pitch / 2;
  const empty = values.length === 0;

  // A weekly average is a separate summary from the daily bars. Missing days
  // are unknown rather than zero, and today is excluded while still in progress.
  const trendSegments: TrendSegment[] = [];
  if (mode === "day") {
    const weeks = new Map<string, number[]>();
    data.forEach((datum, i) => {
      const monday = dayKey(weekStart(new Date(`${datum.key}T12:00:00`)));
      weeks.set(monday, [...(weeks.get(monday) ?? []), i]);
    });

    for (const indexes of weeks.values()) {
      const completeValues = indexes.flatMap((i) => {
        const datum = data[i]!;
        return datum.value !== null && !datum.partial ? [datum.value] : [];
      });
      if (completeValues.length === 0) continue;

      const average = completeValues.reduce((sum, value) => sum + value, 0) / completeValues.length;
      const first = indexes[0]!;
      const last = indexes[indexes.length - 1]!;
      trendSegments.push({
        x1: MARGIN.left + first * pitch + 2,
        x2: MARGIN.left + (last + 1) * pitch - 2,
        y: y(average),
        provisional: completeValues.length === 1,
      });
    }
  }

  const current = active !== null ? data[active] : undefined;
  const last = data[n - 1];
  const endLabel = last?.partial ? (mode === "day" ? "today" : "this week") : last?.short;

  function select(i: number, pin: boolean) {
    if (pin && pinned && active === i) {
      setPinned(false);
      setActive(null);
      return;
    }
    setActive(i);
    if (pin) setPinned(true);
  }

  return (
    <section className="overflow-hidden rounded-panel border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pb-1 pt-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {/* Legend: needed once there's a second series to tell apart */}
        {mode === "day" && !empty && (
          <span className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-accent" aria-hidden />
              {mode === "day" ? "daily" : "weekly"}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3.5 rounded-full bg-foreground" aria-hidden />
              weekly avg · Mon–Sun
            </span>
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
            className="block select-none"
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse" && !pinned) setActive(null);
            }}
          >
            {/* Grid and y ticks */}
            {ticks.map((v) => (
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
                  {tickLabel(v)}
                </text>
              </g>
            ))}

            {/* Hovered slot wash */}
            {active !== null && (
              <rect
                x={MARGIN.left + active * pitch}
                y={MARGIN.top}
                width={pitch}
                height={PLOT_H}
                fill="var(--line)"
                fillOpacity={0.35}
              />
            )}

            {/* Bars */}
            {data.map((d, i) => {
              const x = MARGIN.left + i * pitch + (pitch - barW) / 2;
              if (d.value === null) {
                return (
                  <line
                    key={d.key}
                    x1={cx(i)}
                    x2={cx(i)}
                    y1={baseline - 2}
                    y2={baseline + 2}
                    stroke="var(--muted)"
                    strokeWidth={1}
                  />
                );
              }
              const path = barPath(x, y(d.value), baseline, barW);
              return d.partial ? (
                <path
                  key={d.key}
                  d={path}
                  fill="var(--accent)"
                  fillOpacity={0.18}
                  stroke="var(--accent)"
                  strokeWidth={1}
                />
              ) : (
                <path
                  key={d.key}
                  d={path}
                  fill="var(--accent)"
                  style={active === i ? { filter: "brightness(1.15)" } : undefined}
                />
              );
            })}

            {/* Goal hairline, labeled at its end */}
            {goal !== null && !empty && (
              <g>
                <line
                  x1={MARGIN.left}
                  x2={width - MARGIN.right}
                  y1={y(goal)}
                  y2={y(goal)}
                  stroke="var(--foreground)"
                  strokeWidth={1}
                />
                <text
                  x={width - MARGIN.right}
                  y={y(goal) - 4}
                  textAnchor="end"
                  fontSize={10}
                  fill="var(--muted)"
                  className="font-mono tabular-nums"
                >
                  goal {goal}
                  {unit === "g" ? " g" : ""}
                </text>
              </g>
            )}

            {/* Average completed logged day for each Monday-to-Sunday week */}
            {trendSegments.length > 0 && (
              <g>
                {trendSegments.map((segment, i) => (
                  <line
                    key={i}
                    x1={segment.x1}
                    x2={segment.x2}
                    y1={segment.y}
                    y2={segment.y}
                    stroke="var(--foreground)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeDasharray={segment.provisional ? "4 3" : undefined}
                  />
                ))}
              </g>
            )}

            {/* X labels: first and last slot only; the tooltip and table carry the rest */}
            {data[0] && (
              <text
                x={MARGIN.left}
                y={height - 7}
                fontSize={10}
                fill="var(--muted)"
                className="font-mono"
              >
                {data[0].short}
              </text>
            )}
            {n > 1 && endLabel && (
              <text
                x={width - MARGIN.right}
                y={height - 7}
                textAnchor="end"
                fontSize={10}
                fill="var(--muted)"
                className="font-mono"
              >
                {endLabel}
              </text>
            )}

            {empty && (
              <text
                x={MARGIN.left + plotW / 2}
                y={MARGIN.top + PLOT_H / 2}
                textAnchor="middle"
                fontSize={13}
                fill="var(--muted)"
              >
                No meals in this range
              </text>
            )}

            {/* Hit targets: the whole slot, gap included, so nobody has to land on a bar */}
            {!empty &&
              data.map((d, i) => (
                <rect
                  key={d.key}
                  x={MARGIN.left + i * pitch}
                  y={MARGIN.top}
                  width={pitch}
                  height={PLOT_H}
                  fill="transparent"
                  onPointerMove={(e) => {
                    if (e.pointerType === "mouse" && !pinned) setActive(i);
                  }}
                  onPointerDown={(e) => select(i, e.pointerType !== "mouse")}
                />
              ))}
          </svg>
        )}

        {current && width > 0 && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 z-10 max-w-[70%] rounded-panel border border-line bg-surface-raised px-3 py-2 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            style={
              cx(active!) < width / 2
                ? { left: cx(active!) + 8 }
                : { right: width - cx(active!) + 8 }
            }
          >
            <div className="text-muted">{current.label}</div>
            <div className="font-mono tabular-nums">
              {current.value === null ? (
                <span className="text-muted">no meals</span>
              ) : (
                <>
                  <span className="text-sm font-bold text-foreground">
                    {Math.round(current.value)}
                  </span>
                  <span className="text-muted">
                    {" "}
                    {unit}
                    {goal !== null && ` · ${signed(current.value - goal)} vs goal`}
                  </span>
                </>
              )}
            </div>
            {current.value !== null && <div className="font-mono text-muted">{current.detail}</div>}
          </div>
        )}
      </div>

      <details className="group border-t border-line">
        <summary className="cursor-pointer select-none px-4 py-2 text-xs font-semibold text-accent [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Show as table</span>
          <span className="hidden group-open:inline">Hide table</span>
        </summary>
        <div className="max-h-72 overflow-y-auto border-t border-line">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.08em] text-muted">
                <th className="px-4 py-2 text-left font-semibold">
                  {mode === "day" ? "Day" : "Week"}
                </th>
                <th className="px-2 py-2 text-right font-semibold">{unit}</th>
                {goal !== null && (
                  <th className="py-2 pl-2 pr-4 text-right font-semibold">vs goal</th>
                )}
              </tr>
            </thead>
            <tbody className="font-mono text-xs tabular-nums text-muted">
              {[...data].reverse().map((d) => (
                <tr key={d.key} className="border-t border-line/60">
                  <td className="px-4 py-1.5 font-sans text-[13px] text-foreground">
                    {d.short}
                    {d.partial && <span className="text-muted"> (so far)</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {d.value === null ? "—" : Math.round(d.value)}
                  </td>
                  {goal !== null && (
                    <td className="py-1.5 pl-2 pr-4 text-right">
                      {d.value === null ? "" : signed(d.value - goal)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
