"use client";

import { NotebookText, PencilLine, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { statusColor } from "@/components/goal-colors";
import { ZoomableImage } from "@/components/ImageLightbox";
import { SkeletonLog } from "@/components/loaders";
import { EditMealSheet } from "@/components/meals/EditMealSheet";
import { MealMenu, useMealActions } from "@/components/meals/MealActions";
import { mealName, MealRow } from "@/components/meals/MealRow";
import { MonthCalendar, type CalendarDay } from "@/components/MonthCalendar";
import { useMounted } from "@/components/useMounted";
import { useWaterTracking } from "@/components/WaterTracking";
import { getMealPhotoAction } from "@/app/actions";
import { dayKey, dayLabel } from "@/lib/day";
import { dayChip, goalStatus, type GoalStatus, type Metric } from "@/lib/goal-status";
import type { LoggedMeal } from "@/lib/log";
import type { StoredPlan } from "@/lib/plan-history";
import { targetsForDay, type DayTargets } from "@/lib/plan-targets";
import { sumTotals } from "@/lib/scale";
import type { MealTotals } from "@/lib/schema";
import { foodAmount, foodUnit, formatWater } from "@/lib/water";

/** The track runs to 120% of the target, with a tick at the target itself. */
const TRACK_SCALE = 1.2;
const n = (value: number) => Math.round(value).toLocaleString("en-US");

const CHIP: Record<GoalStatus, string> = {
  met: "bg-success-soft text-success",
  over: "bg-danger-soft text-danger",
  short: "bg-[#33291a] text-amber",
  near: "bg-[#33291a] text-amber",
  progress: "bg-surface-raised text-tint-lose",
};

/** The anchor each day's section gets, so the calendar (and Stats) can jump to it. */
const dayAnchor = (key: string) => `day-${key}`;

/** "Today" / "Yesterday" / "Thursday", plus the date beside it. */
function dayTitle(key: string): { name: string; date: string } {
  const label = dayLabel(key);
  const d = new Date(`${key}T12:00:00`);
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (label === "Today" || label === "Yesterday") {
    return { name: label, date: `${d.toLocaleDateString("en-GB", { weekday: "short" })} ${date}` };
  }
  return { name: d.toLocaleDateString("en-GB", { weekday: "long" }), date };
}

function MiniBar({
  metric,
  totals,
  targets,
  isToday,
}: {
  metric: Metric;
  totals: MealTotals;
  targets: DayTargets;
  isToday: boolean;
}) {
  const value = metric === "calories" ? totals.calories : totals.protein_g;
  const target = metric === "calories" ? targets.calorieTarget : targets.proteinTarget;
  const color = statusColor(targets.goal, goalStatus(targets.goal, metric, value, target, isToday));
  return (
    <div className="min-w-0">
      <div className="flex justify-between gap-2 text-xs text-muted">
        {metric === "calories" ? "Calories" : "Protein"}
        <span className="tabular-nums">
          <b className="font-bold text-foreground">{n(value)}</b> / {n(target)}
          {metric === "protein" && " g"}
        </span>
      </div>
      <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-line-strong">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${Math.min(value / (target * TRACK_SCALE), 1) * 100}%`,
            background: color,
          }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground/60"
          style={{ left: `${100 / TRACK_SCALE}%` }}
        />
      </div>
    </div>
  );
}

/** A day's header: its name, how it went (or what's left today) and two slim bars. */
function DayCard({
  dayKeyValue,
  totals,
  targets,
  isToday,
}: {
  dayKeyValue: string;
  totals: MealTotals;
  targets: DayTargets | null;
  isToday: boolean;
}) {
  const waterTracking = useWaterTracking();
  const { name, date } = dayTitle(dayKeyValue);
  const status = targets
    ? goalStatus(targets.goal, "calories", totals.calories, targets.calorieTarget, isToday)
    : null;
  return (
    <div className="flex flex-col gap-2.5 rounded-[20px] bg-surface p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-extrabold tracking-tight">
          {name}
          <span className="ml-1.5 text-[12.5px] font-medium tracking-normal text-muted">
            {date}
          </span>
        </h2>
        {targets && status ? (
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${CHIP[status]}`}>
            {dayChip(targets.goal, "calories", status, totals.calories, targets.calorieTarget)}
          </span>
        ) : (
          <span className="text-[13px] font-bold tabular-nums">{n(totals.calories)} kcal</span>
        )}
      </div>
      {targets && (
        <div className="grid grid-cols-2 gap-3">
          <MiniBar metric="calories" totals={totals} targets={targets} isToday={isToday} />
          <MiniBar metric="protein" totals={totals} targets={targets} isToday={isToday} />
        </div>
      )}
      {waterTracking && totals.water_ml !== undefined && totals.water_ml > 0 && (
        <p className="text-xs text-muted">
          Water {formatWater(totals.water_ml)}
          {targets?.waterGoalMl ? ` of ${formatWater(targets.waterGoalMl)}` : ""}
        </p>
      )}
    </div>
  );
}

/** One meal: a row that opens in place to show what's in it and what you can do with it. */
function LogMeal({ meal, readOnly }: { meal: LoggedMeal; readOnly: boolean }) {
  const waterTracking = useWaterTracking();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const { pending, relog, remove } = useMealActions(meal);
  const totals = meal.analysis.totals;

  if (!open) {
    return (
      <MealRow
        meal={meal}
        readOnly={readOnly}
        expanded={false}
        onSelect={() => setOpen(true)}
        end={readOnly ? undefined : <MealMenu meal={meal} />}
      />
    );
  }
  return (
    <div
      className={`flex flex-col gap-3 rounded-[22px] bg-surface p-3 ${pending ? "opacity-60" : ""}`}
    >
      <MealRow meal={meal} readOnly={readOnly} expanded onSelect={() => setOpen(false)} />
      {meal.thumbnail && (
        <ZoomableImage
          src={meal.thumbnail}
          alt={mealName(meal)}
          label={`View photo of ${mealName(meal)}`}
          load={
            readOnly ? undefined : async () => (await getMealPhotoAction(meal.id)).photo ?? null
          }
          className="h-[130px] w-full rounded-[16px]"
          imgClassName="h-full w-full object-cover"
        />
      )}
      <ul>
        {meal.analysis.foods.map((food, i) => (
          <li
            key={`${food.name}-${i}`}
            className="flex justify-between gap-3 border-t border-line py-2 text-sm first:border-t-0"
          >
            <b className="min-w-0 font-semibold">{food.name}</b>
            <span className="shrink-0 text-muted tabular-nums">
              {/* Typed-in foods have no portion */}
              {food.quickEntry ? "" : `${Math.round(foodAmount(food))} ${foodUnit(food)} · `}
              {n(food.calories)} kcal
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[12.5px] text-muted tabular-nums">
        {Math.round(totals.protein_g)} g protein · {Math.round(totals.carbs_g)} g carbs ·{" "}
        {Math.round(totals.fat_g)} g fat
        {waterTracking &&
          totals.water_ml !== undefined &&
          ` · water ${formatWater(totals.water_ml)}`}
      </p>
      {meal.description && <p className="text-[12.5px] text-muted">Note: {meal.description}</p>}
      {!readOnly && (
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditing(true)}>
            <PencilLine className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
            Edit
          </Button>
          <Button variant="secondary" size="sm" disabled={pending} onClick={relog}>
            <RotateCcw className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
            Log again
          </Button>
          <Button
            variant="destructive"
            size="icon"
            aria-label={`Delete ${mealName(meal)}`}
            disabled={pending}
            onClick={remove}
          >
            <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          </Button>
        </div>
      )}
      <EditMealSheet meal={meal} open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}

/**
 * The Log: every day newest first, as a day card with its meals (also newest
 * first) underneath.
 * On desktop, month calendars stay in a column on the left; tapping a day
 * scrolls to it. Each day is judged by the plan that applied on it.
 * `readOnly` (the admin's view of another account) hides every action.
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
  // Days and times follow the viewer's timezone, so they're rendered only in the browser
  const mounted = useMounted();
  const [selected, setSelected] = useState<string | null>(null);

  // Stats' calendar links here as /log#day-YYYY-MM-DD; the days render after
  // mounting, so the browser's own jump to the anchor finds nothing
  useEffect(() => {
    if (!mounted || !window.location.hash.startsWith("#day-")) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [mounted]);

  if (!mounted) return <SkeletonLog />;

  const todayKey = dayKey(new Date());
  const days = new Map<string, LoggedMeal[]>();
  // The list arrives newest first, and both the days and their meals keep that order
  for (const meal of meals) {
    const key = dayKey(meal.loggedAt);
    days.set(key, [...(days.get(key) ?? []), meal]);
  }
  const dayKeys = [...days.keys()];
  const totalsOf = (key: string) => sumTotals((days.get(key) ?? []).map((m) => m.analysis.totals));

  function dayStatus(key: string): CalendarDay {
    if (key > todayKey) return "none";
    const dayMeals = days.get(key);
    const targets = targetsForDay(plans, key, waterGoalMl);
    if (!dayMeals) return key === todayKey ? "today" : "empty";
    if (!targets) return "met";
    const status = goalStatus(
      targets.goal,
      "calories",
      totalsOf(key).calories,
      targets.calorieTarget,
      key === todayKey,
    );
    return status === "progress" ? "today" : status;
  }

  // This month and the one before, newest first
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const months: [number, number][] = [
    [now.getFullYear(), now.getMonth()],
    [prev.getFullYear(), prev.getMonth()],
  ];

  function jumpTo(key: string) {
    setSelected(key);
    document.getElementById(dayAnchor(key))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (meals.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2.5 rounded-[22px] bg-surface px-5 py-7 text-center lg:col-span-2">
        <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-surface-raised text-accent">
          <NotebookText className="h-7 w-7" strokeWidth={1.9} aria-hidden />
        </span>
        <p className="text-[17px] font-extrabold">No meals logged yet</p>
        <p className="max-w-xs text-[13.5px] text-muted">
          {readOnly
            ? "Nothing has been logged on this account."
            : "Everything you log on Home shows up here, grouped by day."}
        </p>
        {!readOnly && <ButtonLink href="/">Add your first meal</ButtonLink>}
      </div>
    );
  }

  return (
    <>
      <aside className="hidden rounded-[22px] bg-surface p-4 lg:sticky lg:top-6 lg:block">
        <p className="mb-3 text-[12.5px] text-muted">Tap a day to jump to it</p>
        <MonthCalendar
          months={months}
          today={todayKey}
          dayStatus={dayStatus}
          onSelect={jumpTo}
          selected={selected}
        />
      </aside>
      <div className="flex min-w-0 flex-col gap-2">
        {dayKeys.map((key) => (
          <section
            key={key}
            id={dayAnchor(key)}
            aria-label={dayLabel(key)}
            // Clears the sticky top bar on phones when jumped to
            className="flex scroll-mt-32 flex-col gap-2 pb-3 lg:scroll-mt-6"
          >
            <DayCard
              dayKeyValue={key}
              totals={totalsOf(key)}
              targets={targetsForDay(plans, key, waterGoalMl)}
              isToday={key === todayKey}
            />
            <div className="flex flex-col gap-2 px-0.5">
              {days.get(key)!.map((meal) => (
                <LogMeal key={meal.id} meal={meal} readOnly={readOnly} />
              ))}
            </div>
          </section>
        ))}
        <p className="py-2 text-center text-xs text-muted">
          First meal logged {dayLabel(dayKeys.at(-1)!)}
        </p>
      </div>
    </>
  );
}
