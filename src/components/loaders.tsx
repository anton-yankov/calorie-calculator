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

/** A few ghost meal rows, the shape of `MealRow` with its ⋯ button. */
function GhostMealRows() {
  return [0, 1, 2].map((i) => (
    <div key={i} aria-hidden className="flex items-center gap-3 px-0.5 py-1">
      <GhostBar className="h-12 w-12 rounded-[16px]" />
      <div className="min-w-0 flex-1">
        <GhostBar className={`h-4 ${i === 1 ? "w-40" : "w-28"}`} />
        <GhostBar className="mt-1.5 h-3 w-24" />
      </div>
      <GhostBar className="h-4 w-10" />
      <GhostBar className="h-11 w-11 rounded-panel" />
    </div>
  ));
}

/** Ghost version of the homepage's "Eaten today": its heading and a few meal rows. */
export function SkeletonDayMeals({ className = "" }: { className?: string }) {
  return (
    <div role="status" aria-label="Meals loading" className={`flex flex-col gap-2 ${className}`}>
      <GhostBar className="mt-2 mb-1 h-5 w-32" />
      <GhostMealRows />
    </div>
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
        <GhostMealRows />
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

/** Ghost version of the admin's account header: back button and email, badge, three key numbers. */
export function SkeletonAccountHeader() {
  return (
    <>
      <div role="status" aria-label="Account loading" className="flex items-center gap-3">
        <div aria-hidden className="h-11 w-11 shrink-0 rounded-[14px] bg-surface" />
        <GhostBar className="h-5 w-48" />
      </div>
      <GhostBar className="h-6 w-56 rounded-full" />
      <div aria-hidden className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex h-[78px] flex-col gap-2 rounded-[18px] bg-surface p-3">
            <GhostBar className="h-3 w-12" />
            <GhostBar className="h-4 w-16" />
          </div>
        ))}
      </div>
    </>
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

/**
 * Ghost version of the Stats page: the section switch and range, the
 * calendar card and two tiles on one side, two chart frames on the other.
 */
export function SkeletonStats() {
  return (
    <>
      <div
        aria-hidden
        className="flex flex-col gap-2.5 lg:col-span-2 lg:flex-row lg:justify-between"
      >
        <GhostBar className="h-12 rounded-[16px] lg:w-[300px]" />
        <GhostBar className="h-11 w-56 rounded-[12px]" />
      </div>
      <div role="status" aria-label="Stats loading" className="flex flex-col gap-3">
        <div aria-hidden className="h-[400px] rounded-[22px] bg-surface" />
        <div aria-hidden className="grid grid-cols-2 gap-2.5">
          <div className="h-[92px] rounded-[20px] bg-surface" />
          <div className="h-[92px] rounded-[20px] bg-surface" />
        </div>
      </div>
      <div aria-hidden className="flex flex-col gap-3">
        <div className="h-[250px] rounded-[22px] bg-surface" />
        <div className="h-[250px] rounded-[22px] bg-surface" />
      </div>
    </>
  );
}
