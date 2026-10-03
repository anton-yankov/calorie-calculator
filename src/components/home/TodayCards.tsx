"use client";

import type { TodayProgress } from "@/app/actions";
import { statusColor } from "@/components/goal-colors";
import { dayChip, goalStatus, MAINTAIN_RANGE, type Metric } from "@/lib/goal-status";

/** The track runs to 120% of the target, with a tick at the target itself. */
const TRACK_SCALE = 1.2;
const n = (value: number) => Math.round(value).toLocaleString("en-US");

/** "910 left" → big "910" + small "left"; "Over by 140" → "140" + "over"; "On track" as is. */
function headline(chip: string, unit: string): { big: string; small: string } {
  const open = chip.match(/^([\d,]+) (left|to go)$/);
  if (open) return { big: `${open[1]}${unit}`, small: open[2]! };
  const past = chip.match(/^(Over|Short) by ([\d,]+)$/);
  if (past) return { big: `${past[2]}${unit}`, small: past[1]!.toLowerCase() };
  return { big: chip, small: "" };
}

function StatCard({
  metric,
  label,
  progress,
  isToday,
}: {
  metric: Metric;
  label: string;
  progress: TodayProgress;
  isToday: boolean;
}) {
  const targets = progress.targets!;
  const value = metric === "calories" ? progress.totals.calories : progress.totals.protein_g;
  const target = metric === "calories" ? targets.calorieTarget : targets.proteinTarget;
  const status = goalStatus(targets.goal, metric, value, target, isToday);
  const color = statusColor(targets.goal, status);
  const unit = metric === "protein" ? " g" : "";
  const { big, small } = headline(dayChip(targets.goal, metric, status, value, target), unit);
  const width = Math.min(value / (target * TRACK_SCALE), 1) * 100;
  // For maintaining, the on-track range is shaded on the track itself
  const range = targets.goal === "maintain" && metric === "calories";
  const caption = `${n(value)} of ${n(target)}${unit}`;

  return (
    <div className="min-w-0 rounded-[20px] bg-surface p-3.5">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span
        className="block text-[26px] leading-tight font-extrabold tracking-tight tabular-nums"
        style={status === "over" || status === "short" ? { color } : undefined}
      >
        {big}
        {small && (
          <span className="ml-1 text-[13px] font-medium tracking-normal text-muted">{small}</span>
        )}
      </span>
      <div
        role="progressbar"
        aria-label={`${label} vs target`}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={Math.round(target * TRACK_SCALE)}
        aria-valuetext={`${caption}. ${big} ${small}`}
        className="relative mt-2.5 h-1.5 overflow-hidden rounded-full bg-line-strong"
      >
        {range && (
          <div
            className="absolute inset-y-0 bg-success/25"
            style={{
              left: `${((1 - MAINTAIN_RANGE) / TRACK_SCALE) * 100}%`,
              width: `${((2 * MAINTAIN_RANGE) / TRACK_SCALE) * 100}%`,
            }}
          />
        )}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
          style={{ width: `${width}%`, background: color }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground/60"
          style={{ left: `${100 / TRACK_SCALE}%` }}
        />
      </div>
      <span className="mt-1.5 block text-xs text-muted">{caption}</span>
    </div>
  );
}

/**
 * Calories and protein for the day as two cards: the headline is what's left
 * (or how it went), judged by the day's goal exactly like the bars elsewhere.
 * Grey placeholders hold the space until the numbers arrive.
 */
export function TodayCards({
  progress,
  isToday,
}: {
  progress: TodayProgress | null;
  isToday: boolean;
}) {
  if (!progress) {
    return (
      <div role="status" aria-label="Today's numbers loading" className="grid grid-cols-2 gap-2.5">
        {[0, 1].map((i) => (
          <div key={i} className="ghost-shimmer h-[112px] rounded-[20px] bg-surface" />
        ))}
      </div>
    );
  }
  if (!progress.targets) return null;
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <StatCard metric="calories" label="Calories" progress={progress} isToday={isToday} />
      <StatCard metric="protein" label="Protein" progress={progress} isToday={isToday} />
    </div>
  );
}
