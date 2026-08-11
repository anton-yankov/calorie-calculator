"use client";

import { useState } from "react";
import type { Confidence, FoodItem, MealAnalysis } from "@/lib/schema";

const confidenceStyles: Record<Confidence, string> = {
  high: "border-success/50 bg-success-soft text-success",
  medium: "border-accent/50 bg-accent-soft text-accent",
  low: "border-danger/50 bg-danger-soft text-danger",
};

const fmt = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(1));
const norm = (name: string) => name.trim().toLowerCase();

/** ▲/▼ kcal change vs the previous estimate; hidden when the change is < 1 kcal. */
function Delta({ now, before }: { now: number; before: number | null }) {
  if (before === null) return null;
  const diff = Math.round(now) - Math.round(before);
  if (diff === 0) return null;
  const up = diff > 0;
  return (
    <span
      className={`font-mono text-xs tabular-nums ${up ? "text-accent" : "text-success"}`}
      aria-label={`${up ? "up" : "down"} ${Math.abs(diff)} calories from previous estimate`}
    >
      {up ? "▲" : "▼"}
      {Math.abs(diff)}
    </span>
  );
}

function FoodRow({
  food,
  prevKcal,
  isNew,
  disabled,
  onGramsChange,
}: {
  food: FoodItem;
  prevKcal: number | null;
  isNew: boolean;
  disabled: boolean;
  onGramsChange: (grams: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // Local draft so the field can be empty mid-edit; null = not editing, show real grams
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-medium">{food.name}</span>
        {isNew && (
          <span className="shrink-0 rounded-full border border-success/50 bg-success-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-success">
            new
          </span>
        )}
        <label className="flex shrink-0 items-center gap-1 text-xs text-muted">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={draft ?? Math.round(food.grams).toString()}
            disabled={disabled}
            aria-label={`Grams of ${food.name}`}
            onChange={(e) => {
              setDraft(e.target.value);
              const grams = Number(e.target.value);
              if (e.target.value.trim() !== "" && Number.isFinite(grams) && grams >= 0) {
                onGramsChange(grams);
              }
            }}
            onBlur={() => setDraft(null)}
            className="w-14 rounded-md border border-line bg-background px-1 py-1 text-right font-mono text-sm tabular-nums text-foreground focus:border-accent focus:outline-none"
          />
          g
        </label>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 flex w-full items-center gap-1.5 text-left"
      >
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${confidenceStyles[food.confidence]}`}
        >
          {food.confidence}
        </span>
        <span className={`text-xs text-muted ${expanded ? "" : "truncate"}`}>
          {food.assumptions}
        </span>
      </button>

      <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="flex items-baseline gap-1.5 font-mono text-sm tabular-nums">
          <span className="font-semibold">{Math.round(food.calories)}</span>
          <span className="text-xs text-muted">kcal</span>
          <Delta now={food.calories} before={prevKcal} />
        </span>
        <span className="font-mono text-xs tabular-nums text-muted">
          P {fmt(food.protein_g)} · C {fmt(food.carbs_g)} · F {fmt(food.fat_g)}
        </span>
      </div>
    </li>
  );
}

interface AnalysisCardProps {
  analysis: MealAnalysis;
  /** The estimate this one revises — enables ▲/▼ deltas, "new" chips, and the removed line. */
  previous: MealAnalysis | null;
  label: string;
  disabled: boolean;
  onGramsChange: (foodIndex: number, grams: number) => void;
}

export function AnalysisCard({
  analysis,
  previous,
  label,
  disabled,
  onGramsChange,
}: AnalysisCardProps) {
  const prevByName = new Map(previous?.foods.map((f) => [norm(f.name), f]) ?? []);
  const currentNames = new Set(analysis.foods.map((f) => norm(f.name)));
  const removed = previous?.foods.filter((f) => !currentNames.has(norm(f.name))) ?? [];

  return (
    <section className="overflow-hidden rounded-panel border border-line bg-surface">
      <header className="flex items-baseline justify-between border-b border-line bg-surface-raised px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          {label}
        </span>
        {previous && <span className="text-[11px] text-muted">▲▼ show change vs previous</span>}
      </header>

      <ul className="divide-y divide-line">
        {analysis.foods.map((food, i) => (
          <FoodRow
            key={`${food.name}-${i}`}
            food={food}
            prevKcal={prevByName.get(norm(food.name))?.calories ?? (previous ? null : null)}
            isNew={previous !== null && !prevByName.has(norm(food.name))}
            disabled={disabled}
            onGramsChange={(grams) => onGramsChange(i, grams)}
          />
        ))}
      </ul>

      {removed.length > 0 && (
        <p className="border-t border-line px-4 py-2 text-xs text-muted line-through">
          Removed: {removed.map((f) => f.name).join(", ")}
        </p>
      )}

      <footer className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t-2 border-foreground px-4 py-3">
        <span className="flex items-baseline gap-1.5 font-mono tabular-nums">
          <span className="text-lg font-bold">{Math.round(analysis.totals.calories)}</span>
          <span className="text-xs text-muted">kcal total</span>
          <Delta now={analysis.totals.calories} before={previous?.totals.calories ?? null} />
        </span>
        <span className="font-mono text-xs tabular-nums text-muted">
          P {fmt(analysis.totals.protein_g)} · C {fmt(analysis.totals.carbs_g)} · F{" "}
          {fmt(analysis.totals.fat_g)}
        </span>
      </footer>

      {analysis.notes && (
        <p className="border-t border-line px-4 py-2.5 text-xs text-muted">{analysis.notes}</p>
      )}
    </section>
  );
}

/** Collapsed view of a superseded estimate — summary line, expandable to a read-only list. */
export function CompactAnalysis({ analysis, label }: { analysis: MealAnalysis; label: string }) {
  return (
    <details className="rounded-panel border border-line bg-surface/60 transition-colors open:bg-surface">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm text-muted">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          {label}
        </span>
        <span className="ml-2 font-mono tabular-nums">
          {Math.round(analysis.totals.calories)} kcal
        </span>
        <span className="ml-2 text-xs">{analysis.foods.length} items</span>
      </summary>
      <ul className="border-t border-line px-4 py-1.5">
        {analysis.foods.map((food, i) => (
          <li
            key={`${food.name}-${i}`}
            className="flex items-baseline justify-between gap-2 py-1 text-sm text-muted"
          >
            <span className="min-w-0 truncate">{food.name}</span>
            <span className="shrink-0 font-mono text-xs tabular-nums">
              {Math.round(food.grams)} g · {Math.round(food.calories)} kcal
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
