"use client";

import { RANGES, type RangeId } from "@/lib/stats";

/** Segmented control for the stats range, styled like the nav's tab pill. */
export function RangePicker({
  value,
  onChange,
}: {
  value: RangeId;
  onChange: (range: RangeId) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Range"
      className="flex self-start rounded-full border border-line bg-surface p-1"
    >
      {RANGES.map((range) => {
        const active = range.id === value;
        return (
          <button
            key={range.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(range.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              active ? "bg-accent text-background" : "text-muted hover:text-foreground"
            }`}
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}
