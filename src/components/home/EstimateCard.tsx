"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import type { TodayProgress } from "@/app/actions";
import { useAnalysis } from "@/components/AnalysisProvider";
import { Button } from "@/components/Button";
import { DatePicker } from "@/components/DatePicker";
import { DrinkTypeSelect } from "@/components/DrinkTypeSelect";
import { ZoomableImage } from "@/components/ImageLightbox";
import { useWaterTracking } from "@/components/WaterTracking";
import { dayKey, dayLabel } from "@/lib/day";
import type { Confidence, FoodItem, MealAnalysis, MealTotals } from "@/lib/schema";
import { foodAmount, foodUnit, formatWater, mealWeight, type DrinkType } from "@/lib/water";
import { MealPhoto } from "./MealCards";

const CONFIDENCE: Record<Confidence, string> = {
  high: "bg-success-soft text-success",
  medium: "bg-accent-soft text-accent",
  low: "bg-danger-soft text-danger",
};

const n = (value: number) => Math.round(value).toLocaleString("en-US");
const norm = (name: string) => name.trim().toLowerCase();

/** ▲/▼ kcal change vs the previous estimate; nothing when it moved by less than 1 kcal. */
function Delta({ now, before }: { now: number; before: number | null }) {
  if (before === null) return null;
  const diff = Math.round(now) - Math.round(before);
  if (diff === 0) return null;
  const up = diff > 0;
  return (
    <span
      className={`ml-1 tabular-nums ${up ? "text-accent" : "text-success"}`}
      aria-label={`${up ? "up" : "down"} ${Math.abs(diff)} calories from the previous estimate`}
    >
      {up ? "▲" : "▼"}
      {Math.abs(diff)}
    </span>
  );
}

function FoodRow({
  food,
  before,
  isNew,
  disabled,
  onGramsChange,
  onDrinkTypeChange,
}: {
  food: FoodItem;
  /** The same food in the previous estimate, for the ▲/▼ change */
  before: FoodItem | null;
  isNew: boolean;
  disabled: boolean;
  onGramsChange: (grams: number) => void;
  onDrinkTypeChange: (type: DrinkType | null) => void;
}) {
  const waterTracking = useWaterTracking();
  const [open, setOpen] = useState(false);
  // Local draft so the field can be empty mid-edit; null = show the real amount
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <li className="border-t border-line py-2.5 first:border-t-0">
      <div className="flex items-center gap-2.5">
        {food.imageUrl && (
          <ZoomableImage
            src={food.imageUrl}
            alt={food.name}
            label={`View image of ${food.name}`}
            className="h-9 w-9 shrink-0 rounded-[10px] bg-background"
            imgClassName="h-full w-full object-contain"
          />
        )}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <span className="text-[14.5px] leading-snug font-bold">{food.name}</span>{" "}
          <span
            className={`rounded-full px-2 py-px align-[1px] text-[11.5px] font-bold ${CONFIDENCE[food.confidence]}`}
          >
            {food.confidence}
          </span>
          {isNew && (
            <span className="ml-1 rounded-full bg-success-soft px-2 py-px align-[1px] text-[11.5px] font-bold text-success">
              new
            </span>
          )}
          <span className="block text-[12.5px] text-muted">
            {n(food.calories)} kcal
            <Delta now={food.calories} before={before?.calories ?? null} /> ·{" "}
            {Math.round(food.protein_g)} g protein
          </span>
        </button>
        <label className="flex h-11 w-[84px] shrink-0 items-center rounded-panel border-[1.5px] border-line-strong bg-background pr-3 focus-within:border-accent">
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
                onGramsChange(grams);
              }
            }}
            onBlur={() => setDraft(null)}
            className="w-full min-w-0 bg-transparent pl-2.5 text-right text-sm font-bold tabular-nums focus:outline-none"
          />
          <span className="pl-1 text-[13px] text-muted">{foodUnit(food)}</span>
        </label>
      </div>
      {open && (
        <div className="mt-2 flex flex-col gap-2 text-[12.5px] text-muted">
          {food.assumptions && <p>{food.assumptions}</p>}
          <p className="tabular-nums">
            {Math.round(food.carbs_g)} g carbs · {Math.round(food.fat_g)} g fat
          </p>
          {waterTracking && (
            <DrinkTypeSelect
              value={food.drink_type ?? null}
              name={food.name}
              disabled={disabled}
              onChange={onDrinkTypeChange}
            />
          )}
        </div>
      )}
      {waterTracking && food.volume_ml != null && (
        <p className="mt-1 text-[12.5px] text-muted">{formatWater(food.volume_ml)} toward Water</p>
      )}
    </li>
  );
}

/** What the day looks like once this meal is logged, in the goal's own words. */
function afterThisMeal(progress: TodayProgress, meal: MealTotals): string | null {
  const targets = progress.targets;
  if (!targets) return null;
  const kcal = targets.calorieTarget - (progress.totals.calories + meal.calories);
  const protein = targets.proteinTarget - (progress.totals.protein_g + meal.protein_g);
  const calories =
    kcal >= 0
      ? `${n(kcal)} kcal ${targets.goal === "gain" ? "to go" : "left"}`
      : `${n(-kcal)} kcal ${targets.goal === "gain" ? "past your target" : "over"}`;
  const proteinText = protein > 0 ? `${n(protein)} g protein to go` : "protein target reached";
  return `${calories} · ${proteinText}`;
}

/**
 * The latest estimate: each food with its amount as a field (editing it
 * recalculates at once), the totals, what the day looks like after this meal,
 * and the day picker with Log. `previous` is the estimate a correction revised,
 * for the ▲/▼ changes and "new" chips.
 */
export function EstimateCard({
  analysis,
  previous,
  label,
  durationMs,
  progress,
  onLogged,
}: {
  analysis: MealAnalysis;
  previous: MealAnalysis | null;
  label: string;
  durationMs: number | null;
  progress: TodayProgress | null;
  /** After a successful log, with the new meal's id and the day it landed on */
  onLogged: (id: string, day: string) => void;
}) {
  const waterTracking = useWaterTracking();
  const {
    loading,
    logging,
    error,
    logDate,
    setLogDate,
    handleGramsChange,
    handleDrinkTypeChange,
    handleLog,
  } = useAnalysis();
  const todayKey = dayKey(new Date());
  const before = new Map(previous?.foods.map((f) => [norm(f.name), f]) ?? []);
  const names = new Set(analysis.foods.map((f) => norm(f.name)));
  const removed = previous?.foods.filter((f) => !names.has(norm(f.name))) ?? [];
  const after = progress ? afterThisMeal(progress, analysis.totals) : null;
  const t = analysis.totals;
  const weight = mealWeight(analysis.foods);

  return (
    <section aria-label={label} className="flex flex-col gap-3 rounded-[22px] bg-surface p-4">
      <MealPhoto />
      <div>
        <h2 className="text-base font-extrabold tracking-tight">{label}</h2>
        <p className="text-[13px] text-muted">
          {durationMs !== null ? `Done in ${Math.max(1, Math.round(durationMs / 1000))} s · ` : ""}
          tap a weight to change it
        </p>
      </div>
      <ul>
        {analysis.foods.map((food, i) => (
          <FoodRow
            key={`${food.name}-${i}`}
            food={food}
            before={before.get(norm(food.name)) ?? null}
            isNew={previous !== null && !before.has(norm(food.name))}
            disabled={loading || logging}
            onGramsChange={(grams) => handleGramsChange(i, grams)}
            onDrinkTypeChange={(type) => handleDrinkTypeChange(i, type)}
          />
        ))}
      </ul>
      {removed.length > 0 && (
        <p className="text-[12.5px] text-muted line-through">
          Removed: {removed.map((f) => f.name).join(", ")}
        </p>
      )}
      <div className="flex flex-col gap-0.5 border-t-2 border-line-strong pt-2.5">
        <span className="text-[22px] font-extrabold tracking-tight tabular-nums">
          {n(t.calories)} kcal
          <Delta now={t.calories} before={previous?.totals.calories ?? null} />
          {weight && <span className="text-muted"> · {weight}</span>}
        </span>
        <span className="text-[13.5px] text-muted tabular-nums">
          {Math.round(t.protein_g)} g protein · {Math.round(t.carbs_g)} g carbs ·{" "}
          {Math.round(t.fat_g)} g fat
          {waterTracking && t.water_ml !== undefined && ` · water ${formatWater(t.water_ml)}`}
        </span>
      </div>
      {analysis.notes && <p className="text-[12.5px] text-muted">{analysis.notes}</p>}
      {after && (
        <p className="flex flex-col gap-0.5 rounded-panel bg-surface-raised px-3 py-2.5 text-[13.5px] text-muted">
          <span className="text-xs">After this meal</span>
          <b className="font-semibold text-foreground">{after}</b>
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-panel bg-danger-soft px-3.5 py-2.5 text-sm font-semibold text-danger"
        >
          {error}
        </p>
      )}
      <div className="flex gap-2">
        {/* Which day the meal lands on, capped at today */}
        <DatePicker
          value={logDate ?? todayKey}
          max={todayKey}
          disabled={logging}
          onChange={setLogDate}
          ariaLabel="Day to log this meal to"
          className="h-11 rounded-panel border-[1.5px] border-line-strong bg-transparent px-3.5 text-sm font-bold"
        />
        <Button
          size="sm"
          className="flex-1"
          pending={logging}
          disabled={loading}
          onClick={() =>
            void handleLog().then((plate) => {
              if (plate) onLogged(plate.id, plate.day);
            })
          }
        >
          {!logging && <Check className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden />}
          {logging ? "Logging…" : `Log to ${logDate ? dayLabel(logDate) : "today"}`}
        </Button>
      </div>
    </section>
  );
}

/** An estimate a correction replaced, folded down to one line. */
export function EarlierEstimate({
  analysis,
  label,
  correction,
}: {
  analysis: MealAnalysis;
  label: string;
  /** The correction that led to the next estimate */
  correction: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <details className="rounded-[18px] bg-surface/60 px-4 py-2.5 text-sm text-muted open:bg-surface">
        <summary className="cursor-pointer select-none">
          <b className="text-foreground">{label}</b> · {n(analysis.totals.calories)} kcal ·{" "}
          {analysis.foods.length} {analysis.foods.length === 1 ? "item" : "items"}
        </summary>
        <ul className="mt-2 flex flex-col gap-1">
          {analysis.foods.map((food, i) => (
            <li key={`${food.name}-${i}`} className="flex justify-between gap-2 tabular-nums">
              <span className="min-w-0 truncate">{food.name}</span>
              <span className="shrink-0">
                {Math.round(foodAmount(food))} {foodUnit(food)} · {n(food.calories)} kcal
              </span>
            </li>
          ))}
        </ul>
      </details>
      {correction && (
        <p className="max-w-[85%] self-end rounded-[18px] rounded-br-md bg-surface-raised px-3.5 py-2.5 text-sm">
          {correction}
        </p>
      )}
    </div>
  );
}
