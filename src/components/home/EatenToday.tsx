"use client";

import type { TodayProgress } from "@/app/actions";
import { MealMenu } from "@/components/meals/MealActions";
import { MealRow } from "@/components/meals/MealRow";
import { dayLabel } from "@/lib/day";

/** The day's meals under everything else on the homepage, each with its ⋯ menu. */
export function EatenToday({
  progress,
  day,
  isToday,
  highlightId,
  onChanged,
  className = "",
}: {
  progress: TodayProgress | null;
  day: string;
  isToday: boolean;
  /** The meal just logged, tinted for a moment */
  highlightId: string | null;
  onChanged: () => void;
  className?: string;
}) {
  if (!progress) return null;
  const { meals, totals } = progress;
  return (
    <section aria-label="Meals this day" className={`flex flex-col gap-2 ${className}`}>
      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-extrabold tracking-tight">
          {isToday ? "Eaten today" : `Eaten ${dayLabel(day)}`}
        </h2>
        {meals.length > 0 && (
          <span className="text-[13px] text-muted">
            {meals.length} {meals.length === 1 ? "meal" : "meals"} ·{" "}
            {Math.round(totals.calories).toLocaleString("en-US")} kcal
          </span>
        )}
      </div>
      {meals.length === 0 ? (
        <div className="rounded-[22px] bg-surface px-5 py-6 text-center">
          <p className="font-extrabold">Nothing logged yet {isToday ? "today" : "this day"}</p>
          <p className="mt-1 text-[13.5px] text-muted">Your meals show up here as you add them.</p>
        </div>
      ) : (
        meals.map((meal) => (
          <MealRow
            key={meal.id}
            meal={meal}
            highlight={meal.id === highlightId}
            end={<MealMenu meal={meal} onChanged={onChanged} />}
          />
        ))
      )}
    </section>
  );
}
