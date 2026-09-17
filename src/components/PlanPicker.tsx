"use client";

import { useState } from "react";
import { Field } from "@/components/fields";
import { Spinner } from "@/components/loaders";
import { longDate } from "@/lib/day";
import {
  bmr,
  customPlanOutlook,
  maintenanceCalories,
  suggestPlans,
  type ActivityLevel,
  type BodyDetails,
  type Goal,
} from "@/lib/plan";

export interface PlanChoice {
  /** The chosen pace, or null when the targets were typed in */
  kgPerWeek: number | null;
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
 * The plan step: maintenance with its workings, the suggested paces, and an
 * escape hatch for your own numbers. Shared by setup and by "Change plan" in
 * Settings, so both always offer the same plans.
 *
 * Everything here is a preview — the action recomputes the targets from these
 * same functions before saving.
 */
export function PlanPicker({
  body,
  goal,
  goalWeightKg,
  today,
  submitLabel,
  pending,
  onSubmit,
}: {
  body: BodyDetails;
  goal: Goal;
  /** null when maintaining */
  goalWeightKg: number | null;
  today: string;
  submitLabel: string;
  pending: boolean;
  onSubmit: (choice: PlanChoice) => void;
}) {
  const [pace, setPace] = useState<number | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");

  const year = Number(today.slice(0, 4));
  const restingRate = bmr(body, year);
  const maintenance = maintenanceCalories(body, year);
  const plans = suggestPlans(body, goal, goalWeightKg, today);

  const outlook =
    customOpen && Number(calories) > 0
      ? customPlanOutlook(body, goal, goalWeightKg, Number(calories), today)
      : null;
  const customReady = Number(calories) >= 800 && Number(protein) >= 20;
  const ready = customOpen ? customReady : pace !== null;

  function submit() {
    onSubmit(
      customOpen
        ? {
            kgPerWeek: null,
            custom: {
              calorieTarget: Math.round(Number(calories)),
              proteinTarget: Math.round(Number(protein)),
            },
          }
        : { kgPerWeek: pace, custom: null },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-panel border border-dashed border-line px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-muted">Your maintenance</span>
          <span className="font-mono text-[17px] font-bold tabular-nums">
            ≈ {fmt(maintenance)} kcal
          </span>
        </div>
        <details className="mt-1.5 text-xs text-muted">
          <summary className="cursor-pointer font-semibold text-accent">How we got this</summary>
          <p className="mt-1.5 font-mono text-[11.5px] leading-relaxed text-foreground">
            BMR = 10×{body.weightKg} + 6.25×{body.heightCm} − 5×{year - body.birthYear}
            {body.sex === "male" ? " + 5" : " − 161"} = {fmt(restingRate)}
            <br />
            {ACTIVITY_LABELS[body.activityLevel]}: {fmt(restingRate)} ×{" "}
            {(maintenance / restingRate).toFixed(3)} ≈ {fmt(maintenance)} kcal
          </p>
        </details>
      </div>

      {!customOpen && (
        <div className="flex flex-col gap-2.5">
          {plans.map((plan) => (
            <button
              key={plan.name}
              type="button"
              aria-pressed={pace === plan.kgPerWeek}
              onClick={() => setPace(plan.kgPerWeek)}
              className={`rounded-panel border px-3.5 py-3 text-left transition-colors ${
                pace === plan.kgPerWeek ? "border-accent bg-accent-soft" : "border-line bg-surface"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-[14.5px] font-bold">
                  {plan.name}
                  {plan.recommended && (
                    <span className="ml-1.5 rounded-full border border-success px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.08em] text-success">
                      Recommended
                    </span>
                  )}
                </span>
                <span className="font-mono text-xs text-muted">
                  {plan.kgPerWeek === 0
                    ? "± 0"
                    : `${goal === "lose" ? "−" : "+"}${plan.kgPerWeek.toFixed(2)}`}{" "}
                  kg/wk
                </span>
              </span>
              <span className="mt-2 flex gap-4">
                <span>
                  <span className="font-mono text-xl font-bold tabular-nums">
                    {fmt(plan.calorieTarget)}
                  </span>
                  <span className="ml-1 text-[11.5px] text-muted">kcal</span>
                </span>
                <span>
                  <span className="font-mono text-xl font-bold tabular-nums">
                    {plan.proteinTarget}
                  </span>
                  <span className="ml-1 text-[11.5px] text-muted">g protein</span>
                </span>
              </span>
              <span className="mt-1.5 block text-xs text-muted">
                {plan.goalDate === null ? (
                  `No goal date: keeps you steady at ${body.weightKg} kg`
                ) : (
                  <>
                    Reach {goalWeightKg} kg in ≈ {Math.round(plan.weeksToGoal ?? 0)} weeks ·{" "}
                    <span className="font-semibold text-foreground">{longDate(plan.goalDate)}</span>
                  </>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setCustomOpen(!customOpen);
          setPace(null);
        }}
        className="text-left text-[13.5px] font-semibold text-accent"
      >
        {customOpen ? "Back to the suggested plans" : "Set my own calories and protein instead"}
      </button>

      {customOpen && (
        <div className="flex flex-col gap-3 rounded-panel border border-line bg-surface px-3.5 py-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Calories" unit="kcal" value={calories} onChange={setCalories} />
            <Field label="Protein" unit="g" value={protein} onChange={setProtein} />
          </div>
          {outlook?.kind === "impossible" && (
            <p className="rounded-r-panel border-l-4 border-danger bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger">
              At this intake it&apos;s impossible to reach your goal weight.
            </p>
          )}
          {outlook?.kind === "reachable" && (
            <p className="text-[13px] text-muted">
              About <b className="text-foreground">{outlook.kgPerWeek.toFixed(2)} kg a week</b> ·
              reach {goalWeightKg} kg around{" "}
              <b className="text-foreground">{longDate(outlook.goalDate)}</b>
            </p>
          )}
          {outlook?.kind === "maintain" && (
            <p className="text-[13px] text-muted">
              {Math.abs(outlook.weeklyChangeKg) < 0.01
                ? "Exactly your maintenance."
                : `About ${Math.abs(outlook.weeklyChangeKg).toFixed(2)} kg a week ${
                    outlook.weeklyChangeKg < 0 ? "lost" : "gained"
                  }.`}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={!ready || pending}
        onClick={submit}
        className="flex items-center justify-center gap-2 rounded-panel bg-accent px-4 py-3 font-semibold text-background transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending && <Spinner />}
        {pending ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}
