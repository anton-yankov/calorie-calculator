"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteMealAction, logMealAction, relogMealAction, updateMealAction } from "@/app/actions";
import { GoalBars } from "@/components/GoalBars";
import type { LoggedMeal } from "@/lib/log";
import { scaleFood, sumTotals } from "@/lib/scale";
import type { FoodItem, MealTotals } from "@/lib/schema";
import type { Goals } from "@/lib/settings";

const fmt = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(1));
const pad = (n: number) => String(n).padStart(2, "0");

// Day grouping happens on the client so days follow the viewer's timezone,
// not the server's (Vercel runs in UTC).
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

/** Grams cell in edit mode — local draft so the field can be empty mid-edit. */
function GramsInput({
  food,
  disabled,
  onChange,
}: {
  food: FoodItem;
  disabled: boolean;
  onChange: (grams: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
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
          onChange(grams);
        }
      }}
      onBlur={() => setDraft(null)}
      className="w-14 rounded-md border border-line bg-background px-1 py-0.5 text-right font-mono text-xs tabular-nums text-foreground focus:border-accent focus:outline-none"
    />
  );
}

function MealEntry({ meal }: { meal: LoggedMeal }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  // Edit drafts; grams edits rescale from the saved analysis (the baseline)
  const [draftFoods, setDraftFoods] = useState<FoodItem[] | null>(null);
  const [timeDraft, setTimeDraft] = useState("");

  const foods = draftFoods ?? meal.analysis.foods;
  const totals: MealTotals = draftFoods ? sumTotals(draftFoods) : meal.analysis.totals;
  const names = meal.analysis.foods.map((f) => f.name).join(", ");
  const time = new Date(meal.loggedAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  function startEdit() {
    const d = new Date(meal.loggedAt);
    setTimeDraft(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setDraftFoods(meal.analysis.foods.map((f) => ({ ...f })));
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraftFoods(null);
  }

  function handleGramsChange(index: number, grams: number) {
    setDraftFoods((prev) => {
      if (!prev) return prev;
      const base = meal.analysis.foods[index];
      return prev.map((f, i) =>
        i === index ? (base ? scaleFood(base, grams) : { ...f, grams }) : f,
      );
    });
  }

  function handleSave() {
    if (!draftFoods) return;
    // Same local date, edited wall-clock time
    const when = new Date(meal.loggedAt);
    const [h, m] = timeDraft.split(":").map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) when.setHours(h!, m!, 0, 0);
    const analysis = { ...meal.analysis, foods: draftFoods, totals: sumTotals(draftFoods) };
    startTransition(async () => {
      const result = await updateMealAction(meal.id, { analysis, loggedAt: when.toISOString() });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Meal updated");
      setEditing(false);
      setDraftFoods(null);
    });
  }

  function handleRelog() {
    startTransition(async () => {
      const result = await relogMealAction(meal.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const newId = result.newId;
      toast.success("Logged to today", {
        action: newId
          ? {
              label: "Undo",
              onClick: () =>
                void deleteMealAction(newId).then((r) => {
                  if (r.error) toast.error(r.error);
                }),
            }
          : undefined,
      });
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteMealAction(meal.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      // Undo re-inserts the exact same row — the client still holds all of it
      toast("Meal deleted", {
        action: {
          label: "Undo",
          onClick: () =>
            void logMealAction(meal).then((r) => {
              if (r.error) toast.error(r.error);
            }),
        },
      });
    });
  }

  return (
    <details
      className={`group overflow-hidden rounded-panel border border-line bg-surface transition-colors open:bg-surface-raised ${pending ? "opacity-50" : ""}`}
    >
      <summary className="block cursor-pointer select-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
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
            <span className="line-clamp-2 text-sm font-medium">{names || "Meal"}</span>
            <span className="font-mono text-xs text-muted">{time}</span>
          </span>
          <span className="shrink-0 font-mono tabular-nums">
            <span className="text-[15px] font-bold">{Math.round(totals.calories)}</span>
            <span className="ml-1 text-xs text-muted">kcal</span>
          </span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
          {(
            [
              ["protein", totals.protein_g],
              ["carbs", totals.carbs_g],
              ["fat", totals.fat_g],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="px-2 py-1.5 text-center">
              <span className="block font-mono text-[13px] tabular-nums">{fmt(value)} g</span>
              <span className="block text-[10px] uppercase tracking-[0.08em] text-muted">
                {label}
              </span>
            </div>
          ))}
        </div>
      </summary>

      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-[420px] border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.08em] text-muted">
              <th className="px-4 py-2 text-left font-semibold">Food</th>
              <th className="px-2 py-2 text-right font-semibold">Grams</th>
              <th className="px-2 py-2 text-right font-semibold">kcal</th>
              <th className="px-2 py-2 text-right font-semibold">P</th>
              <th className="px-2 py-2 text-right font-semibold">C</th>
              <th className="py-2 pl-2 pr-4 text-right font-semibold">F</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs tabular-nums text-muted">
            {foods.map((food, i) => (
              <tr key={`${food.name}-${i}`} className="border-t border-line/60">
                <td className="px-4 py-1.5 font-sans text-[13px] font-medium text-foreground">
                  {food.name}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {editing ? (
                    <GramsInput
                      food={food}
                      disabled={pending}
                      onChange={(grams) => handleGramsChange(i, grams)}
                    />
                  ) : (
                    Math.round(food.grams)
                  )}
                </td>
                <td className="px-2 py-1.5 text-right">{Math.round(food.calories)}</td>
                <td className="px-2 py-1.5 text-right">{fmt(food.protein_g)}</td>
                <td className="px-2 py-1.5 text-right">{fmt(food.carbs_g)}</td>
                <td className="py-1.5 pl-2 pr-4 text-right">{fmt(food.fat_g)}</td>
              </tr>
            ))}
            <tr className="border-t border-line font-semibold text-foreground">
              <td className="px-4 py-2 font-sans text-[13px]">Total</td>
              <td className="px-2 py-2 text-right">
                {Math.round(foods.reduce((sum, f) => sum + f.grams, 0))}
              </td>
              <td className="px-2 py-2 text-right">{Math.round(totals.calories)}</td>
              <td className="px-2 py-2 text-right">{fmt(totals.protein_g)}</td>
              <td className="px-2 py-2 text-right">{fmt(totals.carbs_g)}</td>
              <td className="py-2 pl-2 pr-4 text-right">{fmt(totals.fat_g)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {meal.description && (
        <p className="border-t border-line/60 px-4 py-2 text-xs text-muted">
          Note: {meal.description}
        </p>
      )}

      <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-xs font-semibold">
        {editing ? (
          <>
            <label className="flex items-center gap-1.5 font-normal text-muted">
              Time
              <input
                type="time"
                value={timeDraft}
                disabled={pending}
                onChange={(e) => setTimeDraft(e.target.value)}
                className="rounded-md border border-line bg-background px-1.5 py-0.5 font-mono text-xs text-foreground focus:border-accent focus:outline-none"
              />
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={handleSave}
              className="ml-auto text-success hover:underline disabled:text-muted"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={cancelEdit}
              className="text-muted hover:underline"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={startEdit}
              className="text-accent hover:underline disabled:text-muted"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={handleRelog}
              className="text-success hover:underline disabled:text-muted"
            >
              {pending ? "Logging…" : "Log again"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={handleDelete}
              className="ml-auto text-danger hover:underline disabled:text-muted"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </details>
  );
}

export function LogList({ meals, goals }: { meals: LoggedMeal[]; goals: Goals | null }) {
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
        const totals = sumTotals(dayMeals.map((m) => m.analysis.totals));
        return (
          <section key={key} className="flex flex-col gap-2">
            <header className="flex flex-col gap-1.5 px-1 pt-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h2 className="font-serif text-xl font-semibold text-foreground">
                  {dayLabel(key)}
                </h2>
                <span className="font-mono text-sm tabular-nums">
                  <span className="font-bold">{Math.round(totals.calories)}</span>
                  <span className="text-xs text-muted">
                    {" "}
                    kcal · P {fmt(totals.protein_g)} · C {fmt(totals.carbs_g)} · F{" "}
                    {fmt(totals.fat_g)}
                  </span>
                </span>
              </div>
              {goals && <GoalBars totals={totals} goals={goals} />}
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
