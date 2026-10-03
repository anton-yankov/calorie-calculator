"use client";

import { LoaderCircle } from "lucide-react";

/** Inline spinner for button-level action feedback. Static under prefers-reduced-motion. */
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <LoaderCircle
      className={`motion-safe:animate-spin ${className}`}
      strokeWidth={2.5}
      aria-hidden
    />
  );
}

function GhostBar({ className, style }: { className: string; style?: React.CSSProperties }) {
  return (
    <div className={`ghost-shimmer rounded-md bg-surface-raised ${className}`} style={style} />
  );
}

/**
 * Ghost version of the Log: the calendar column (desktop only), then a day
 * card with a few meal rows, the same shapes the real list fills in.
 */
export function SkeletonLog() {
  return (
    <>
      <div aria-hidden className="hidden h-[540px] rounded-[22px] bg-surface lg:block" />
      <div role="status" aria-label="Meal log loading" className="flex flex-col gap-2">
        <div aria-hidden className="flex flex-col gap-2.5 rounded-[20px] bg-surface p-3.5">
          <div className="flex justify-between">
            <GhostBar className="h-4 w-32" />
            <GhostBar className="h-4 w-16 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <GhostBar className="h-6" />
            <GhostBar className="h-6" />
          </div>
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} aria-hidden className="flex items-center gap-3 px-0.5 py-1">
            <GhostBar className="h-12 w-12 rounded-[16px]" />
            <div className="min-w-0 flex-1">
              <GhostBar className={`h-4 ${i === 1 ? "w-40" : "w-28"}`} />
              <GhostBar className="mt-1.5 h-3 w-24" />
            </div>
            <GhostBar className="h-4 w-10" />
            <GhostBar className="h-11 w-11 rounded-panel" />
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * A column of ghost panels for pages whose content is mostly forms and tables
 * (Settings, admin). `heights` sets each panel's height in pixels.
 */
export function SkeletonPanels({ label, heights }: { label: string; heights: number[] }) {
  return (
    <div role="status" aria-label={`${label} loading`} className="flex flex-col gap-4">
      {heights.map((height, i) => (
        <div
          key={i}
          aria-hidden
          className="flex flex-col gap-3 rounded-[20px] bg-surface p-4"
          style={{ height }}
        >
          <GhostBar className={`h-3 ${i % 2 ? "w-24" : "w-32"}`} />
          <GhostBar className="h-3.5 w-3/4" />
          <GhostBar className="h-3.5 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** Ghost version of the product list: a few product rows. */
export function SkeletonProducts() {
  return (
    <div
      role="status"
      aria-label="Products loading"
      className="grid gap-2.5 lg:grid-cols-2 xl:grid-cols-3"
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          aria-hidden
          className="flex items-center gap-3 rounded-[20px] bg-surface p-2.5"
        >
          <GhostBar className="h-14 w-14 rounded-[16px]" />
          <div className="min-w-0 flex-1">
            <GhostBar className={`h-4 ${i % 2 ? "w-40" : "w-28"}`} />
            <GhostBar className="mt-1.5 h-3 w-44" />
          </div>
          <GhostBar className="h-11 w-11 rounded-panel" />
        </div>
      ))}
    </div>
  );
}

const GHOST_BARS = [62, 78, 55, 84, 70, 66, 88, 74, 58, 80, 68, 76, 64, 82];

function GhostTiles({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-[20px] bg-surface px-4 py-3">
          <GhostBar className="h-2.5 w-20" />
          <GhostBar className={`mt-2.5 h-7 ${i % 2 ? "w-14" : "w-20"}`} />
          <GhostBar className="mt-2.5 h-2.5 w-28" />
        </div>
      ))}
    </div>
  );
}

/**
 * Ghost version of the stats page: range pill, four tiles, the macro split,
 * the weight tiles and form in one column; three chart frames and the weigh-ins
 * list in the other. `contents` lets the page grid place the two columns itself, exactly
 * where StatsView's columns land.
 */
export function SkeletonStats() {
  return (
    <div role="status" aria-label="Stats loading" className="contents">
      <div className="flex flex-col gap-4" aria-hidden>
        <GhostBar className="h-9 w-44 rounded-full" />
        <GhostTiles count={4} />
        <div className="rounded-[20px] bg-surface px-4 py-3">
          <GhostBar className="h-2.5 w-40" />
          <GhostBar className="mt-2.5 h-2 w-full rounded-full" />
          <GhostBar className="mt-2.5 h-3 w-56" />
        </div>
        <GhostTiles count={2} />
        <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-4">
          <GhostBar className="h-3.5 w-24" />
          <GhostBar className="h-[46px] w-full rounded-panel" />
          <GhostBar className="h-[42px] w-full rounded-panel" />
        </div>
      </div>
      <div className="flex flex-col gap-4" aria-hidden>
        {/* Calories, protein and weight */}
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-[20px] bg-surface px-4 pb-3 pt-3">
            <GhostBar className="h-3.5 w-32" />
            <div className="mt-4 flex h-44 items-end gap-1.5">
              {GHOST_BARS.map((h, j) => (
                <GhostBar key={j} className="flex-1 rounded-t" style={{ height: `${h}%` }} />
              ))}
            </div>
            <GhostBar className="mt-3 h-3 w-24" />
          </div>
        ))}
        <div className="rounded-[20px] bg-surface px-4 py-3">
          <GhostBar className="h-4 w-32" />
        </div>
      </div>
    </div>
  );
}
