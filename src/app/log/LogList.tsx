"use client";

import { useState, useTransition } from "react";
import { deleteMealAction } from "@/app/actions";
import type { LoggedMeal } from "@/lib/log";
import type { MealTotals } from "@/lib/schema";

const fmt = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(1));

// Day grouping happens on the client so days follow the viewer's timezone,
// not the server's (Vercel runs in UTC).
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

function MealEntry({ meal }: { meal: LoggedMeal }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const time = new Date(meal.loggedAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const names = meal.analysis.foods.map((f) => f.name).join(", ");

  function handleDelete() {
    if (!window.confirm("Delete this meal from the log?")) return;
    startTransition(async () => {
      // revalidatePath in the action refreshes the list in the same roundtrip
      const result = await deleteMealAction(meal.id);
      setError(result.error ?? null);
    });
  }

  return (
    <details
      className={`group rounded-panel border border-line bg-surface transition-colors open:bg-surface-raised ${pending ? "opacity-50" : ""}`}
    >
      <summary className="flex cursor-pointer select-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        {meal.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- small data URL
          <img
            src={meal.thumbnail}
            alt=""
            className="h-12 w-12 shrink-0 rounded-panel object-cover"
          />
        ) : (
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-panel border border-line bg-background text-lg"
            aria-hidden
          >
            🍽
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{names || "Meal"}</span>
          <span className="block font-mono text-xs text-muted">{time}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-mono text-sm font-bold tabular-nums">
            {Math.round(meal.analysis.totals.calories)} kcal
          </span>
          <span className="block font-mono text-[11px] tabular-nums text-muted">
            P {fmt(meal.analysis.totals.protein_g)} · C {fmt(meal.analysis.totals.carbs_g)} · F{" "}
            {fmt(meal.analysis.totals.fat_g)}
          </span>
        </span>
      </summary>
      <div className="border-t border-line px-4 py-2.5">
        <ul>
          {meal.analysis.foods.map((food, i) => (
            <li
              key={`${food.name}-${i}`}
              className="flex items-baseline justify-between gap-2 py-1 text-sm"
            >
              <span className="min-w-0 truncate">{food.name}</span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                {Math.round(food.grams)} g · {Math.round(food.calories)} kcal · P{" "}
                {fmt(food.protein_g)} · C {fmt(food.carbs_g)} · F {fmt(food.fat_g)}
              </span>
            </li>
          ))}
        </ul>
        {meal.description && <p className="mt-1 text-xs text-muted">Note: {meal.description}</p>}
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        <button
          type="button"
          disabled={pending}
          onClick={handleDelete}
          className="mt-2 text-xs font-semibold text-danger hover:underline disabled:text-muted"
        >
          {pending ? "Deleting…" : "Delete entry"}
        </button>
      </div>
    </details>
  );
}

export function LogList({ meals }: { meals: LoggedMeal[] }) {
  if (meals.length === 0) {
    return (
      <div className="rounded-panel border-2 border-dashed border-line bg-surface/40 px-5 py-14 text-center text-muted">
        <p className="font-serif text-xl font-semibold text-foreground">No meals logged yet</p>
        <p className="mt-1 text-sm">
          Analyze a photo, then tap “Log meal” to start tracking your day.
        </p>
      </div>
    );
  }

  const days = new Map<string, LoggedMeal[]>();
  for (const meal of meals) {
    const key = dayKey(meal.loggedAt);
    days.set(key, [...(days.get(key) ?? []), meal]);
  }

  return (
    <>
      {[...days.entries()].map(([key, dayMeals]) => {
        const totals = sumTotals(dayMeals);
        return (
          <section key={key} className="flex flex-col gap-2">
            <header className="flex flex-wrap items-baseline justify-between gap-x-3 px-1 pt-3">
              <h2 className="font-serif text-xl font-semibold text-foreground">{dayLabel(key)}</h2>
              <span className="font-mono text-sm tabular-nums">
                <span className="font-bold">{Math.round(totals.calories)}</span>
                <span className="text-xs text-muted">
                  {" "}
                  kcal · P {fmt(totals.protein_g)} · C {fmt(totals.carbs_g)} · F {fmt(totals.fat_g)}
                </span>
              </span>
            </header>
            {dayMeals.map((meal) => (
              <MealEntry key={meal.id} meal={meal} />
            ))}
          </section>
        );
      })}
    </>
  );
}
