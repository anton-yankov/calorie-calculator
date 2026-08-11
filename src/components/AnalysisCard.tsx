"use client";

import { useState } from "react";
import type { Confidence, FoodItem, MealAnalysis } from "@/lib/schema";

const confidenceStyles: Record<Confidence, string> = {
  high: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
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
      className={`font-mono text-xs tabular-nums ${up ? "text-amber-500 dark:text-amber-400" : "text-sky-600 dark:text-sky-400"}`}
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
    <li className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-medium">{food.name}</span>
        {isNew && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            new
          </span>
        )}
        <label className="flex shrink-0 items-center gap-1 text-xs text-neutral-500">
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
            className="w-14 rounded-md border border-neutral-300 bg-transparent px-1 py-1 text-right font-mono text-sm tabular-nums text-neutral-900 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:text-neutral-100"
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
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${confidenceStyles[food.confidence]}`}
        >
          {food.confidence}
        </span>
        <span className={`text-xs text-neutral-500 ${expanded ? "" : "truncate"}`}>
          {food.assumptions}
        </span>
      </button>

      <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="flex items-baseline gap-1.5 font-mono text-sm tabular-nums">
          <span className="font-semibold">{Math.round(food.calories)}</span>
          <span className="text-xs text-neutral-500">kcal</span>
          <Delta now={food.calories} before={prevKcal} />
        </span>
        <span className="font-mono text-xs tabular-nums text-neutral-500">
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
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <header className="flex items-baseline justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {label}
        </span>
        {previous && (
          <span className="text-[11px] text-neutral-400">▲▼ show change vs previous</span>
        )}
      </header>

      <ul className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
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
        <p className="border-t border-neutral-100 px-3 py-2 text-xs text-neutral-500 line-through dark:border-neutral-800/60">
          Removed: {removed.map((f) => f.name).join(", ")}
        </p>
      )}

      <footer className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t-2 border-neutral-300 px-3 py-2.5 dark:border-neutral-700">
        <span className="flex items-baseline gap-1.5 font-mono tabular-nums">
          <span className="text-lg font-bold">{Math.round(analysis.totals.calories)}</span>
          <span className="text-xs text-neutral-500">kcal total</span>
          <Delta now={analysis.totals.calories} before={previous?.totals.calories ?? null} />
        </span>
        <span className="font-mono text-xs tabular-nums text-neutral-500">
          P {fmt(analysis.totals.protein_g)} · C {fmt(analysis.totals.carbs_g)} · F{" "}
          {fmt(analysis.totals.fat_g)}
        </span>
      </footer>

      {analysis.notes && (
        <p className="border-t border-neutral-100 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-800/60">
          {analysis.notes}
        </p>
      )}
    </section>
  );
}

/** Collapsed view of a superseded estimate — summary line, expandable to a read-only list. */
export function CompactAnalysis({ analysis, label }: { analysis: MealAnalysis; label: string }) {
  return (
    <details className="rounded-2xl border border-neutral-200 bg-white/60 dark:border-neutral-800 dark:bg-neutral-900/60">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm text-neutral-500">
        <span className="font-semibold uppercase tracking-wide text-xs">{label}</span>
        <span className="ml-2 font-mono tabular-nums">
          {Math.round(analysis.totals.calories)} kcal
        </span>
        <span className="ml-2 text-xs">{analysis.foods.length} items</span>
      </summary>
      <ul className="border-t border-neutral-100 px-3 py-1.5 dark:border-neutral-800/60">
        {analysis.foods.map((food, i) => (
          <li
            key={`${food.name}-${i}`}
            className="flex items-baseline justify-between gap-2 py-1 text-sm text-neutral-500"
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
