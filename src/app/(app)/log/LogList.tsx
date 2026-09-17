"use client";

import { useWaterTracking } from "@/components/WaterTracking";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteMealAction,
  getMealPhotoAction,
  logMealAction,
  relogMealAction,
  updateMealAction,
} from "@/app/actions";
import { DrinkTypeSelect } from "@/components/DrinkTypeSelect";
import { foodAmount, foodUnit, formatWater, withDrinkType, type DrinkType } from "@/lib/water";
import { DatePicker } from "@/components/DatePicker";
import { GoalBars } from "@/components/GoalBars";
import { ZoomableImage } from "@/components/ImageLightbox";
import { dayKey, dayLabel, timeLabel } from "@/lib/day";
import type { LoggedMeal } from "@/lib/log";
import type { StoredPlan } from "@/lib/plan-history";
import { targetsForDay } from "@/lib/plan-targets";
import { QuickEntry } from "./QuickEntry";
import { scaleFood, sumTotals } from "@/lib/scale";
import type { FoodItem, MealTotals } from "@/lib/schema";

const fmt = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(1));
const pad = (n: number) => String(n).padStart(2, "0");

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
    <label className="inline-flex items-center gap-1">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={draft ?? Math.round(foodAmount(food)).toString()}
        disabled={disabled}
        aria-label={`${foodUnit(food)} of ${food.name}`}
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
      {foodUnit(food)}
    </label>
  );
}

function MealEntry({ meal, readOnly }: { meal: LoggedMeal; readOnly: boolean }) {
  const waterTracking = useWaterTracking();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  // Edit drafts; grams edits rescale from the saved analysis (the baseline)
  const [draftFoods, setDraftFoods] = useState<FoodItem[] | null>(null);
  const [dateDraft, setDateDraft] = useState("");
  const [timeDraft, setTimeDraft] = useState("");

  const foods = draftFoods ?? meal.analysis.foods;
  const totals: MealTotals = draftFoods ? sumTotals(draftFoods) : meal.analysis.totals;
  const names = meal.analysis.foods.map((f) => f.name).join(", ");
  const quickEntry = foods.length > 0 && foods.every((food) => food.quickEntry);
  const time = timeLabel(meal.loggedAt);

  function startEdit() {
    const d = new Date(meal.loggedAt);
    setDateDraft(dayKey(d));
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
      const original = meal.analysis.foods[index];
      const current = prev[index];
      const base =
        original && current && original.drink_type !== current.drink_type
          ? withDrinkType(original, current.drink_type ?? null)
          : original;
      return prev.map((f, i) =>
        i === index ? (base ? scaleFood(base, grams) : { ...f, grams }) : f,
      );
    });
  }

  function handleDrinkTypeChange(index: number, type: DrinkType | null) {
    setDraftFoods(
      (prev) => prev?.map((food, i) => (i === index ? withDrinkType(food, type) : food)) ?? null,
    );
  }

  function handleSave() {
    if (!draftFoods) return;
    // Edited local date and wall-clock time; either draft falls back to the original
    const when = new Date(meal.loggedAt);
    const [y, mo, d] = dateDraft.split("-").map(Number);
    if (y && mo && d) when.setFullYear(y, mo - 1, d);
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
      // Undo re-inserts the row the server returned: the list copy held here
      // never includes the large photo, the deleted row does
      const removed = result.meal ?? meal;
      toast("Meal deleted", {
        action: {
          label: "Undo",
          onClick: () =>
            void logMealAction(removed).then((r) => {
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
            // Opens on the thumbnail at once, then swaps in the large photo.
            // Meals logged before photos were kept just stay on the thumbnail.
            <ZoomableImage
              src={meal.thumbnail}
              alt={names || "Meal"}
              label={`View photo of ${names || "meal"}`}
              // The large photo is fetched as the viewer, so a read-only view keeps the thumbnail
              load={
                readOnly
                  ? undefined
                  : async () => {
                      const result = await getMealPhotoAction(meal.id);
                      return result.photo ?? null;
                    }
              }
              className="h-12 w-12 shrink-0 rounded-panel border border-transparent"
            />
          ) : (
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-panel border border-line bg-background text-lg"
              aria-hidden
            >
              {quickEntry ? "✍" : foods.every((food) => food.drink_type) ? "💧" : "🍽"}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-sm font-medium">{names || "Meal"}</span>
            <span className="font-mono text-xs text-muted">
              {time}
              {quickEntry && " · manual"}
            </span>
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
              <th className="px-2 py-2 text-right font-semibold">Amount</th>
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
                  <span className="flex items-center gap-2">
                    {food.imageUrl && (
                      <ZoomableImage
                        src={food.imageUrl}
                        alt={food.name}
                        label={`View image of ${food.name}`}
                        className="h-6 w-6 shrink-0 rounded border border-line bg-background"
                        imgClassName="object-contain"
                      />
                    )}
                    {food.name}
                  </span>
                  {editing && waterTracking && !food.quickEntry && (
                    <div className="mt-2">
                      <DrinkTypeSelect
                        name={food.name}
                        value={food.drink_type ?? null}
                        disabled={pending}
                        onChange={(type) => handleDrinkTypeChange(i, type)}
                      />
                    </div>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {/* Typed-in foods have no portion to show or scale */}
                  {food.quickEntry ? (
                    "—"
                  ) : editing ? (
                    <GramsInput
                      food={food}
                      disabled={pending}
                      onChange={(grams) => handleGramsChange(i, grams)}
                    />
                  ) : (
                    `${Math.round(foodAmount(food))} ${foodUnit(food)}`
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
                {foods.every((food) => food.volume_ml == null && !food.quickEntry)
                  ? `${Math.round(foods.reduce((sum, food) => sum + food.grams, 0))} g`
                  : "—"}
              </td>
              <td className="px-2 py-2 text-right">{Math.round(totals.calories)}</td>
              <td className="px-2 py-2 text-right">{fmt(totals.protein_g)}</td>
              <td className="px-2 py-2 text-right">{fmt(totals.carbs_g)}</td>
              <td className="py-2 pl-2 pr-4 text-right">{fmt(totals.fat_g)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {waterTracking && totals.water_ml !== undefined && (
        <p className="border-t border-line px-4 py-2 text-xs font-semibold text-muted">
          Water · {formatWater(totals.water_ml)}
        </p>
      )}

      {meal.description && (
        <p className="border-t border-line/60 px-4 py-2 text-xs text-muted">
          Note: {meal.description}
        </p>
      )}

      {!readOnly && (
        <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-xs font-semibold">
          {editing ? (
            <>
              <span className="flex items-center gap-1.5 font-normal text-muted">
                When
                <DatePicker
                  value={dateDraft}
                  max={dayKey(new Date())}
                  disabled={pending}
                  onChange={setDateDraft}
                  className="rounded-md border-line bg-background px-1.5 py-0.5 text-xs"
                />
                <input
                  type="time"
                  value={timeDraft}
                  disabled={pending}
                  aria-label="Time"
                  onChange={(e) => setTimeDraft(e.target.value)}
                  className="rounded-md border border-line bg-background px-1.5 py-0.5 font-mono text-xs text-foreground focus:border-accent focus:outline-none"
                />
              </span>
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
      )}
    </details>
  );
}

/**
 * The Log's two columns: a rail with today's bars (desktop only) and the quick
 * entry, then the days. On desktop the rail sticks while the days scroll, and
 * today's bars live in the rail instead of above today's meals. `readOnly`
 * (the admin's view of another account) drops the quick entry and every edit.
 */
export function LogList({
  meals,
  plans,
  waterGoalMl,
  readOnly = false,
}: {
  meals: LoggedMeal[];
  plans: StoredPlan[];
  waterGoalMl: number | null;
  readOnly?: boolean;
}) {
  const waterTracking = useWaterTracking();
  const todayKey = dayKey(new Date());
  const days = new Map<string, LoggedMeal[]>();
  for (const meal of meals) {
    const key = dayKey(meal.loggedAt);
    days.set(key, [...(days.get(key) ?? []), meal]);
  }
  const todayTargets = targetsForDay(plans, todayKey, waterGoalMl);
  const todayTotals = sumTotals((days.get(todayKey) ?? []).map((m) => m.analysis.totals));

  return (
    <>
      <div className="flex flex-col gap-4 lg:sticky lg:top-24">
        {todayTargets && (
          <div className="hidden flex-col gap-2 rounded-panel border border-line bg-surface px-4 py-3 lg:flex">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Today</span>
            <GoalBars totals={todayTotals} targets={todayTargets} isToday />
          </div>
        )}
        {!readOnly && <QuickEntry />}
      </div>

      <div className="flex flex-col gap-5">
        {meals.length === 0 ? (
          <div className="rounded-panel border-2 border-dashed border-line bg-surface/40 px-5 py-14 text-center text-muted">
            <p className="font-serif text-xl font-semibold text-foreground">No meals logged yet</p>
            {!readOnly && (
              <p className="mt-1 text-sm">
                Analyze a photo and tap “Log meal”, or add a food manually, to start tracking your
                day.
              </p>
            )}
          </div>
        ) : (
          [...days.entries()].map(([key, dayMeals]) => {
            const totals = sumTotals(dayMeals.map((m) => m.analysis.totals));
            // Each day is judged by the plan that applied on it, not today's plan
            const targets = targetsForDay(plans, key, waterGoalMl);
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
                        {waterTracking &&
                          totals.water_ml !== undefined &&
                          ` · Water ${formatWater(totals.water_ml)}`}
                      </span>
                    </span>
                  </div>
                  {targets && (
                    // On desktop, today's bars are already in the rail
                    <div className={key === todayKey ? "lg:hidden" : undefined}>
                      <GoalBars totals={totals} targets={targets} isToday={key === todayKey} />
                    </div>
                  )}
                </header>
                {dayMeals.map((meal) => (
                  <MealEntry key={meal.id} meal={meal} readOnly={readOnly} />
                ))}
              </section>
            );
          })
        )}
      </div>
    </>
  );
}
