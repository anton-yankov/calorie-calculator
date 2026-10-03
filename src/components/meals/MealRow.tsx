"use client";

import { GlassWater, PencilLine, UtensilsCrossed } from "lucide-react";
import { getMealPhotoAction } from "@/app/actions";
import { ZoomableImage } from "@/components/ImageLightbox";
import { timeLabel } from "@/lib/day";
import type { LoggedMeal } from "@/lib/log";

/** The foods in a meal as one name, e.g. "Fried eggs, Toast with butter". */
export const mealName = (meal: LoggedMeal) =>
  meal.analysis.foods.map((food) => food.name).join(", ") || "Meal";

/** Every food was typed in by hand (no portion, no AI). */
const isManual = (meal: LoggedMeal) =>
  meal.analysis.foods.length > 0 && meal.analysis.foods.every((food) => food.quickEntry);

/** The meal's photo (tap for full size), or an icon saying what kind of entry it is. */
function MealThumb({ meal, readOnly }: { meal: LoggedMeal; readOnly: boolean }) {
  if (meal.thumbnail) {
    return (
      <ZoomableImage
        src={meal.thumbnail}
        alt={mealName(meal)}
        label={`View photo of ${mealName(meal)}`}
        // The large photo is fetched as the viewer, so a read-only view keeps the thumbnail
        load={readOnly ? undefined : async () => (await getMealPhotoAction(meal.id)).photo ?? null}
        className="h-12 w-12 shrink-0 rounded-[16px]"
        imgClassName="h-full w-full object-cover"
      />
    );
  }
  const drinks = meal.analysis.foods.length > 0 && meal.analysis.foods.every((f) => f.drink_type);
  const Icon = isManual(meal) ? PencilLine : drinks ? GlassWater : UtensilsCrossed;
  return (
    <span
      aria-hidden
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-surface-raised text-muted"
    >
      <Icon className="h-5 w-5" strokeWidth={1.9} />
    </span>
  );
}

/**
 * One meal as a row: picture, name, time and protein, calories, then whatever
 * the page puts at the end (the ⋯ button). `onSelect` makes the middle of the
 * row a button, e.g. to open it on the Log.
 */
export function MealRow({
  meal,
  readOnly = false,
  highlight = false,
  expanded,
  onSelect,
  end,
}: {
  meal: LoggedMeal;
  readOnly?: boolean;
  /** Just logged: tinted for a moment so it's easy to spot */
  highlight?: boolean;
  /** Set when the row opens and closes, for screen readers */
  expanded?: boolean;
  onSelect?: () => void;
  end?: React.ReactNode;
}) {
  const totals = meal.analysis.totals;
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 text-[14.5px] leading-snug font-bold">{mealName(meal)}</span>
        <span className="block text-[12.5px] text-muted">
          {timeLabel(meal.loggedAt)} · {Math.round(totals.protein_g)} g protein
          {isManual(meal) && " · manual"}
        </span>
      </span>
      <span className="shrink-0 text-[15px] font-extrabold tabular-nums">
        {Math.round(totals.calories).toLocaleString("en-US")}
      </span>
    </>
  );
  return (
    <div
      className={`flex items-center gap-3 rounded-[18px] transition-colors duration-700 ${
        highlight ? "-mx-2 bg-success-soft p-2" : ""
      }`}
    >
      <MealThumb meal={meal} readOnly={readOnly} />
      {onSelect ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onSelect}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
      )}
      {end}
    </div>
  );
}
