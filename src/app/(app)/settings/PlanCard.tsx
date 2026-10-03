import { ButtonLink } from "@/components/Button";
import { addDays, longDate } from "@/lib/day";
import { paceFromCalories, paceName, PROTEIN_LEVELS } from "@/lib/plan";
import type { StoredPlan } from "@/lib/plan-history";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const kg = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/**
 * What a stored plan implies today: its weekly pace (derived from the calories
 * when the plan was custom) and the date it reaches the goal weight.
 */
function planSummary(plan: StoredPlan) {
  const signedPace =
    plan.kgPerWeek === null
      ? paceFromCalories(plan.calorieTarget, plan.maintenanceKcal)
      : plan.goal === "lose"
        ? -plan.kgPerWeek
        : plan.kgPerWeek;
  const towardGoal = plan.goal === "lose" ? signedPace < 0 : signedPace > 0;
  const kgToGo = plan.goalWeightKg === null ? null : Math.abs(plan.goalWeightKg - plan.weightKg);
  const weeks = kgToGo !== null && towardGoal ? kgToGo / Math.abs(signedPace) : null;
  return {
    signedPace,
    reachable: plan.goal === "maintain" || towardGoal,
    goalDate: weeks === null ? null : addDays(plan.effectiveFrom, Math.round(weeks * 7)),
  };
}

/** "Steady · lose 0.5 kg a week", "Custom plan · gain", "Maintain". */
export function planTitle(plan: StoredPlan): string {
  const name = paceName(plan.goal, plan.kgPerWeek) ?? "Custom plan";
  if (plan.goal === "maintain")
    return name === "Maintain" ? "Maintain weight" : `${name} · maintain`;
  const pace = Math.abs(planSummary(plan).signedPace);
  return `${name} · ${plan.goal} ${kg(Math.round(pace * 100) / 100)} kg a week`;
}

/** The plan you're on now, at the top of Settings, with Change plan as the main button. */
export function PlanCard({ plan }: { plan: StoredPlan }) {
  const { reachable, goalDate } = planSummary(plan);
  const level = PROTEIN_LEVELS.find((l) => l.perKg === plan.proteinPerKg);
  return (
    <section
      aria-label="Your plan"
      className="flex flex-col gap-2.5 rounded-[22px] bg-accent-soft p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[16.5px] font-extrabold">{planTitle(plan)}</h2>
        <span className="shrink-0 pt-0.5 text-[12.5px] font-bold whitespace-nowrap text-accent">
          Since {longDate(plan.effectiveFrom)}
        </span>
      </div>
      <div className="flex gap-5">
        <span>
          <b className="text-[26px] font-extrabold tracking-tight tabular-nums">
            {fmt(plan.calorieTarget)}
          </b>
          <span className="ml-1 text-[12.5px] text-muted">kcal</span>
        </span>
        <span>
          <b className="text-[26px] font-extrabold tracking-tight tabular-nums">
            {plan.proteinTarget}
          </b>
          <span className="ml-1 text-[12.5px] text-muted">g protein</span>
        </span>
      </div>
      <p className="text-[13px] text-muted">
        {plan.goalWeightKg !== null && (
          <>
            Goal <b className="text-foreground">{plan.goalWeightKg} kg</b>
            {goalDate && (
              <>
                {" "}
                around <b className="text-foreground">{longDate(goalDate)}</b>
              </>
            )}
          </>
        )}
        {plan.goalWeightKg !== null && level && " · "}
        {level && `protein ${level.label} (${level.perKg.toFixed(1)} g/kg)`}
      </p>
      {!reachable && (
        <p className="rounded-panel bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger">
          At these calories you won&apos;t reach your goal weight.
        </p>
      )}
      <ButtonLink href="/settings/plan" className="mt-1 w-full">
        Change plan
      </ButtonLink>
    </section>
  );
}
