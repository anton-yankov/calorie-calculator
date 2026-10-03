"use client";

import { ChevronRight, PencilLine } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/fields";
import { longDate } from "@/lib/day";
import {
  bmr,
  customPlanOutlook,
  DEFAULT_PROTEIN_PER_KG,
  maintenanceCalories,
  PROTEIN_LEVELS,
  proteinTarget,
  suggestPlans,
  type ActivityLevel,
  type BodyDetails,
  type Goal,
  type ProteinPerKg,
} from "@/lib/plan";

export interface PlanChoice {
  /** The chosen pace, or null when the targets were typed in */
  kgPerWeek: number | null;
  /** The protein level for a suggested pace; null for custom targets */
  proteinPerKg: ProteinPerKg | null;
  custom: { calorieTarget: number; proteinTarget: number } | null;
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary",
  light: "Lightly active",
  moderate: "Moderately active",
  very: "Very active",
  extra: "Extra active",
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/**
 * The main button of a setup-style screen, pinned to the bottom of the screen
 * on phones (so it's never scrolled out of reach) and in the flow on desktop.
 * The page leaves room for it with bottom padding.
 */
export function PinnedAction({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background from-60% to-transparent px-4 pt-8 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:static lg:bg-none lg:p-0">
      <div className="mx-auto max-w-md lg:max-w-none">{children}</div>
    </div>
  );
}

/** Why a typed-in calorie target can't reach the goal, and what would. */
function impossibleMessage(goal: Goal, calories: number, maintenance: number, goalKg: number) {
  if (calories === maintenance) {
    return `At exactly your maintenance your weight stays the same, so you won't reach ${goalKg} kg.`;
  }
  return goal === "lose"
    ? `At ${fmt(calories)} kcal you'd gain weight, so you won't reach ${goalKg} kg. Try less than ${fmt(maintenance)}.`
    : `At ${fmt(calories)} kcal you'd lose weight, so you won't reach ${goalKg} kg. Try more than ${fmt(maintenance)}.`;
}

/**
 * The plan step: maintenance (with how it was worked out), a Custom plan card
 * for your own numbers, the protein level, and the suggested paces. Shared by
 * setup and by Change plan in Settings, so both offer the same plans. On
 * desktop it's two columns: maintenance and custom on the left, the choices on
 * the right.
 *
 * Everything here is a preview: the action recomputes the targets from these
 * same functions before saving.
 */
export function PlanPicker({
  body,
  goal,
  goalWeightKg,
  today,
  pending,
  onSubmit,
}: {
  body: BodyDetails;
  goal: Goal;
  /** null when maintaining */
  goalWeightKg: number | null;
  today: string;
  pending: boolean;
  onSubmit: (choice: PlanChoice) => void;
}) {
  const plans = suggestPlans(body, goal, goalWeightKg, today);
  // Maintaining has one plan, so it starts picked
  const [pace, setPace] = useState<number | null>(plans.length === 1 ? plans[0]!.kgPerWeek : null);
  const [protein, setProtein] = useState<ProteinPerKg>(DEFAULT_PROTEIN_PER_KG);
  const [showWorkings, setShowWorkings] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [calories, setCalories] = useState("");
  const [customProtein, setCustomProtein] = useState("");

  const year = Number(today.slice(0, 4));
  const restingRate = bmr(body, year);
  const maintenance = maintenanceCalories(body, year);
  const withProtein = suggestPlans(body, goal, goalWeightKg, today, protein);
  const level = PROTEIN_LEVELS.find((l) => l.perKg === protein)!;

  const outlook =
    customOpen && Number(calories) > 0
      ? customPlanOutlook(body, goal, goalWeightKg, Number(calories), today)
      : null;
  const customReady = Number(calories) >= 800 && Number(customProtein) >= 20;
  const chosen = withProtein.find((plan) => plan.kgPerWeek === pace);
  const ready = customOpen ? customReady : chosen !== undefined;

  function submit() {
    onSubmit(
      customOpen
        ? {
            kgPerWeek: null,
            proteinPerKg: null,
            custom: {
              calorieTarget: Math.round(Number(calories)),
              proteinTarget: Math.round(Number(customProtein)),
            },
          }
        : { kgPerWeek: pace, proteinPerKg: protein, custom: null },
    );
  }

  const label = pending
    ? "Saving…"
    : customOpen
      ? "Start custom plan"
      : chosen
        ? `Start ${chosen.name} plan`
        : "Pick a pace to continue";

  return (
    <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-2.5 rounded-[20px] bg-surface px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="block text-[12.5px] text-muted">Your maintenance</span>
              <span className="text-2xl font-extrabold tracking-tight tabular-nums">
                ≈ {fmt(maintenance)} kcal
              </span>
            </div>
            <Button
              variant={showWorkings ? "outline" : "secondary"}
              size="sm"
              aria-expanded={showWorkings}
              onClick={() => setShowWorkings((v) => !v)}
            >
              {showWorkings ? "Hide" : "How we got this"}
            </Button>
          </div>
          {showWorkings && (
            <p className="rounded-panel bg-background px-3 py-2.5 text-[13px] leading-relaxed text-muted">
              Resting burn (BMR)
              <b className="block font-bold text-foreground tabular-nums">
                10 × {body.weightKg} + 6.25 × {body.heightCm} − 5 × {year - body.birthYear}
                {body.sex === "male" ? " + 5" : " − 161"} = {fmt(restingRate)}
              </b>
              {ACTIVITY_LABELS[body.activityLevel]}
              <b className="block font-bold text-foreground tabular-nums">
                {fmt(restingRate)} × {(maintenance / restingRate).toFixed(3)} ≈ {fmt(maintenance)}{" "}
                kcal
              </b>
            </p>
          )}
        </div>

        {customOpen ? (
          <div className="flex flex-col gap-3 rounded-[20px] border-2 border-accent bg-accent-soft p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-[42px] w-[42px] items-center justify-center rounded-[14px] bg-surface-raised text-accent">
                <PencilLine className="h-5 w-5" strokeWidth={1.9} aria-hidden />
              </span>
              <span className="text-[15.5px] font-extrabold">
                Custom plan
                <span className="block text-[12.5px] font-normal text-muted">Your own numbers</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Calories" unit="kcal" value={calories} onChange={setCalories} />
              <Field label="Protein" unit="g" value={customProtein} onChange={setCustomProtein} />
            </div>
            {outlook?.kind === "impossible" && goalWeightKg !== null && (
              <p className="rounded-panel bg-danger-soft px-3 py-2.5 text-[13.5px] font-semibold text-danger">
                {impossibleMessage(goal, Math.round(Number(calories)), maintenance, goalWeightKg)}
              </p>
            )}
            {outlook?.kind === "reachable" && (
              <p className="text-[13.5px] text-muted">
                About <b className="text-foreground">{outlook.kgPerWeek.toFixed(2)} kg a week</b> ·
                reach {goalWeightKg} kg around{" "}
                <b className="text-foreground">{longDate(outlook.goalDate)}</b>
              </p>
            )}
            {outlook?.kind === "maintain" && (
              <p className="text-[13.5px] text-muted">
                {Math.abs(outlook.weeklyChangeKg) < 0.01
                  ? "Exactly your maintenance."
                  : `About ${Math.abs(outlook.weeklyChangeKg).toFixed(2)} kg a week ${
                      outlook.weeklyChangeKg < 0 ? "lost" : "gained"
                    }.`}
              </p>
            )}
            <Button variant="outline" className="w-full" onClick={() => setCustomOpen(false)}>
              Back to the suggested plans
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setCustomOpen(true);
              setPace(plans.length === 1 ? pace : null);
            }}
            className="flex items-center gap-3 rounded-[20px] border-2 border-dashed border-line-strong px-4 py-3.5 text-left transition hover:border-muted/60"
          >
            <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] bg-surface-raised text-accent">
              <PencilLine className="h-5 w-5" strokeWidth={1.9} aria-hidden />
            </span>
            <span className="min-w-0 flex-1 text-[15.5px] font-extrabold">
              Custom plan
              <span className="block text-[12.5px] font-normal text-muted">
                Enter your own calories and protein
              </span>
            </span>
            <ChevronRight className="h-5 w-5 text-muted" strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3.5">
        {!customOpen && (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-extrabold">Protein per day</h2>
              <span className="text-[12.5px] text-muted">
                {goal === "lose" && goalWeightKg !== null
                  ? "from your goal weight"
                  : "from your weight"}
              </span>
            </div>
            <div
              role="radiogroup"
              aria-label="Protein level"
              className="grid grid-cols-3 gap-1 rounded-[18px] bg-surface p-1"
            >
              {PROTEIN_LEVELS.map((option) => {
                const active = option.perKg === protein;
                return (
                  <button
                    key={option.perKg}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setProtein(option.perKg)}
                    className={`flex flex-col rounded-[14px] px-1 py-2 text-center text-[12.5px] font-semibold transition-colors ${
                      active ? "bg-accent text-[#241a15]/75" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {option.label}
                    <b
                      className={`text-[19px] leading-tight font-extrabold tracking-tight tabular-nums ${
                        active ? "text-[#241a15]" : "text-foreground"
                      }`}
                    >
                      {proteinTarget(body, goal, goalWeightKg, option.perKg)} g
                    </b>
                    {option.perKg.toFixed(1)} g/kg
                  </button>
                );
              })}
            </div>
            <p className="-mt-1 text-[13px] text-muted">
              <b className="text-foreground">{level.label}:</b> {level.hint.toLowerCase()}.
            </p>

            <h2 className="mt-1 text-[15px] font-extrabold">Pace</h2>
            <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-3">
              {withProtein.map((plan) => {
                const active = pace === plan.kgPerWeek;
                return (
                  <button
                    key={plan.name}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPace(plan.kgPerWeek)}
                    className={`flex flex-col gap-2 rounded-[20px] border-2 px-4 py-3.5 text-left transition-colors ${
                      active
                        ? "border-accent bg-accent-soft"
                        : "border-transparent bg-surface hover:border-line"
                    }`}
                  >
                    <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <span className="text-base font-extrabold">
                        {plan.name}
                        {plan.recommended && (
                          <span className="ml-1.5 rounded-full bg-success-soft px-2 py-0.5 align-[2px] text-[11.5px] font-bold text-success">
                            Recommended
                          </span>
                        )}
                      </span>
                      <span className="text-[13px] font-bold text-muted">
                        {plan.kgPerWeek === 0
                          ? "± 0 kg/wk"
                          : `${goal === "lose" ? "−" : "+"}${plan.kgPerWeek.toFixed(2)} kg/wk`}
                      </span>
                    </span>
                    <span className="flex gap-4">
                      <span>
                        <b className="text-[22px] font-extrabold tracking-tight tabular-nums">
                          {fmt(plan.calorieTarget)}
                        </b>
                        <span className="ml-1 text-[12.5px] text-muted">kcal</span>
                      </span>
                      <span>
                        <b className="text-[22px] font-extrabold tracking-tight tabular-nums">
                          {plan.proteinTarget}
                        </b>
                        <span className="ml-1 text-[12.5px] text-muted">g protein</span>
                      </span>
                    </span>
                    <span className="text-[13px] text-muted">
                      {plan.goalDate === null ? (
                        `Keeps you steady at ${body.weightKg} kg`
                      ) : (
                        <>
                          {goalWeightKg} kg in ≈ {Math.round(plan.weeksToGoal ?? 0)} weeks ·{" "}
                          <b className="text-foreground">{longDate(plan.goalDate)}</b>
                        </>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <PinnedAction>
          <Button className="w-full" pending={pending} disabled={!ready} onClick={submit}>
            {label}
          </Button>
        </PinnedAction>
      </div>
    </div>
  );
}
