"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateMealAction } from "@/app/actions";
import { Button } from "@/components/Button";
import { DatePicker } from "@/components/DatePicker";
import { DrinkTypeSelect } from "@/components/DrinkTypeSelect";
import { Sheet } from "@/components/Sheet";
import { useWaterTracking } from "@/components/WaterTracking";
import { dayKey } from "@/lib/day";
import type { LoggedMeal } from "@/lib/log";
import { scaleFood, sumTotals } from "@/lib/scale";
import type { FoodItem } from "@/lib/schema";
import { foodAmount, foodUnit, withDrinkType, type DrinkType } from "@/lib/water";

const pad = (n: number) => String(n).padStart(2, "0");
const kcal = (n: number) => Math.round(n).toLocaleString("en-US");

/** A food's amount as a big field; a local draft lets it be empty mid-edit. */
function AmountField({
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
    <label className="flex h-11 w-[92px] shrink-0 items-center rounded-panel border-[1.5px] border-line-strong bg-background pr-3 focus-within:border-accent">
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
          if (e.target.value.trim() !== "" && Number.isFinite(grams) && grams >= 0) onChange(grams);
        }}
        onBlur={() => setDraft(null)}
        className="w-full min-w-0 bg-transparent pl-3 text-right text-[15px] font-bold tabular-nums focus:outline-none"
      />
      <span className="pl-1 text-sm text-muted">{foodUnit(food)}</span>
    </label>
  );
}

/** The editor itself; mounted fresh each time the sheet opens, so drafts start from the meal. */
function EditMealForm({
  meal,
  onDone,
  onSaved,
}: {
  meal: LoggedMeal;
  onDone: () => void;
  onSaved?: () => void;
}) {
  const waterTracking = useWaterTracking();
  const [pending, startTransition] = useTransition();
  const [foods, setFoods] = useState<FoodItem[]>(() => meal.analysis.foods.map((f) => ({ ...f })));
  const [day, setDay] = useState(() => dayKey(meal.loggedAt));
  const [time, setTime] = useState(() => {
    const d = new Date(meal.loggedAt);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const totals = sumTotals(foods);

  // Grams edits rescale from the saved food (the baseline), so 0 g never loses the ratios
  function changeGrams(index: number, grams: number) {
    setFoods((prev) => {
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

  function changeDrinkType(index: number, type: DrinkType | null) {
    setFoods((prev) => prev.map((food, i) => (i === index ? withDrinkType(food, type) : food)));
  }

  function save() {
    // The edited local day and wall-clock time; either falls back to the original
    const when = new Date(meal.loggedAt);
    const [y, mo, d] = day.split("-").map(Number);
    if (y && mo && d) when.setFullYear(y, mo - 1, d);
    const [h, m] = time.split(":").map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) when.setHours(h!, m!, 0, 0);
    startTransition(async () => {
      const result = await updateMealAction(meal.id, {
        analysis: { ...meal.analysis, foods, totals },
        loggedAt: when.toISOString(),
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Meal updated");
      onSaved?.();
      onDone();
    });
  }

  return (
    <>
      <ul className="flex flex-col">
        {foods.map((food, i) => (
          <li key={`${food.name}-${i}`} className="border-t border-line py-2.5 first:border-t-0">
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-[14.5px] font-bold leading-snug">
                {food.name}
                <span className="block text-[12.5px] font-normal text-muted">
                  {kcal(food.calories)} kcal · {Math.round(food.protein_g)} g protein
                </span>
              </span>
              {/* Typed-in foods have no portion to scale */}
              {food.quickEntry ? (
                <span className="text-sm text-muted">as typed</span>
              ) : (
                <AmountField food={food} disabled={pending} onChange={(g) => changeGrams(i, g)} />
              )}
            </div>
            {waterTracking && !food.quickEntry && (
              <div className="mt-2">
                <DrinkTypeSelect
                  name={food.name}
                  value={food.drink_type ?? null}
                  disabled={pending}
                  onChange={(type) => changeDrinkType(i, type)}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="flex flex-col gap-0.5 rounded-panel bg-surface-raised px-3 py-2.5 text-[13.5px] text-muted">
        <span className="text-xs">New total</span>
        <span>
          <b className="text-foreground">{kcal(totals.calories)} kcal</b> ·{" "}
          <b className="text-foreground">{Math.round(totals.protein_g)} g</b> protein
          {Math.round(totals.calories) !== Math.round(meal.analysis.totals.calories) &&
            ` (was ${kcal(meal.analysis.totals.calories)} kcal)`}
        </span>
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <span className="mb-1.5 block text-[12.5px] font-semibold text-muted">Day</span>
          <DatePicker
            value={day}
            max={dayKey(new Date())}
            disabled={pending}
            onChange={setDay}
            ariaLabel="Day of this meal"
            className="flex h-12 w-full items-center justify-between rounded-panel border-[1.5px] border-line bg-background px-4 text-[15px]"
          />
        </div>
        <label>
          <span className="mb-1.5 block text-[12.5px] font-semibold text-muted">Time</span>
          <input
            type="time"
            value={time}
            disabled={pending}
            onChange={(e) => setTime(e.target.value)}
            className="h-12 w-full rounded-panel border-[1.5px] border-line bg-background px-4 text-[15px] text-foreground focus:border-accent focus:outline-none"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" disabled={pending} onClick={onDone}>
          Cancel
        </Button>
        <Button pending={pending} onClick={save} className="flex-1">
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </>
  );
}

/** Edit a logged meal's amounts, drink types, day and time, with the new total shown first. */
export function EditMealSheet({
  meal,
  open,
  onClose,
  onSaved,
}: {
  meal: LoggedMeal;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Edit meal">
      {open && <EditMealForm meal={meal} onDone={onClose} onSaved={onSaved} />}
    </Sheet>
  );
}
