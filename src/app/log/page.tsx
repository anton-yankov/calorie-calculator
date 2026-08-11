"use client";

import { useSyncExternalStore } from "react";
import { SkeletonLog } from "@/components/loaders";
import {
  deleteMeal,
  getLogSnapshot,
  getServerLogSnapshot,
  subscribeToLog,
  type LoggedMeal,
} from "@/lib/log";
import type { MealTotals } from "@/lib/schema";

// true only after hydration — the server/first paint renders the skeleton
const noopSubscribe = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

const fmt = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(1));

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(key: string): string {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function sumTotals(meals: LoggedMeal[]): MealTotals {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.analysis.totals.calories,
      protein_g: acc.protein_g + m.analysis.totals.protein_g,
      carbs_g: acc.carbs_g + m.analysis.totals.carbs_g,
      fat_g: acc.fat_g + m.analysis.totals.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

function MealEntry({ meal, onDelete }: { meal: LoggedMeal; onDelete: () => void }) {
  const time = new Date(meal.loggedAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const names = meal.analysis.foods.map((f) => f.name).join(", ");

  return (
    <details className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <summary className="flex cursor-pointer select-none items-center gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        {meal.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- small data URL
          <img src={meal.thumbnail} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
        ) : (
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-lg dark:bg-neutral-800"
            aria-hidden
          >
            🍽
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{names || "Meal"}</span>
          <span className="block text-xs text-neutral-500">{time}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-mono text-sm font-bold tabular-nums">
            {Math.round(meal.analysis.totals.calories)} kcal
          </span>
          <span className="block font-mono text-[11px] tabular-nums text-neutral-500">
            P {fmt(meal.analysis.totals.protein_g)} · C {fmt(meal.analysis.totals.carbs_g)} · F{" "}
            {fmt(meal.analysis.totals.fat_g)}
          </span>
        </span>
      </summary>
      <div className="border-t border-neutral-100 px-3 py-2 dark:border-neutral-800/60">
        <ul>
          {meal.analysis.foods.map((food, i) => (
            <li
              key={`${food.name}-${i}`}
              className="flex items-baseline justify-between gap-2 py-1 text-sm"
            >
              <span className="min-w-0 truncate">{food.name}</span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-neutral-500">
                {Math.round(food.grams)} g · {Math.round(food.calories)} kcal · P{" "}
                {fmt(food.protein_g)} · C {fmt(food.carbs_g)} · F {fmt(food.fat_g)}
              </span>
            </li>
          ))}
        </ul>
        {meal.description && (
          <p className="mt-1 text-xs text-neutral-500">Note: {meal.description}</p>
        )}
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Delete this meal from the log?")) onDelete();
          }}
          className="mt-2 text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
        >
          Delete entry
        </button>
      </div>
    </details>
  );
}

export default function LogPage() {
  // External store over localStorage; server snapshot is empty (no localStorage there)
  const log = useSyncExternalStore(subscribeToLog, getLogSnapshot, getServerLogSnapshot);
  const hydrated = useHydrated();

  const days = new Map<string, LoggedMeal[]>();
  for (const meal of log) {
    const key = dayKey(meal.loggedAt);
    days.set(key, [...(days.get(key) ?? []), meal]);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold">Meal log</h1>
      </header>

      {!hydrated && <SkeletonLog />}

      {hydrated && log.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-neutral-300 px-4 py-12 text-center text-neutral-500 dark:border-neutral-700">
          <p className="font-medium">No meals logged yet</p>
          <p className="mt-1 text-sm">
            Analyze a photo, then tap “Log meal” to start tracking your day.
          </p>
        </div>
      )}

      {[...days.entries()].map(([key, meals]) => {
        const totals = sumTotals(meals);
        return (
          <section key={key} className="flex flex-col gap-2">
            <header className="flex flex-wrap items-baseline justify-between gap-x-3 px-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                {dayLabel(key)}
              </h2>
              <span className="font-mono text-sm tabular-nums">
                <span className="font-bold">{Math.round(totals.calories)}</span>
                <span className="text-xs text-neutral-500">
                  {" "}
                  kcal · P {fmt(totals.protein_g)} · C {fmt(totals.carbs_g)} · F {fmt(totals.fat_g)}
                </span>
              </span>
            </header>
            {meals.map((meal) => (
              <MealEntry key={meal.id} meal={meal} onDelete={() => deleteMeal(meal.id)} />
            ))}
          </section>
        );
      })}
    </main>
  );
}
