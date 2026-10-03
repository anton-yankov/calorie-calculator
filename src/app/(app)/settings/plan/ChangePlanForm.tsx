"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, Segmented } from "@/components/fields";
import { PlanPicker, type PlanChoice } from "@/components/PlanPicker";
import { dayKey } from "@/lib/day";
import type { BodyDetails, Goal } from "@/lib/plan";
import type { StoredPlan } from "@/lib/plan-history";
import type { Profile } from "@/lib/profiles";
import { changePlanAction } from "../actions";

/**
 * A new plan from today: goal and goal weight first, then the same plan step
 * as setup. It's built on the saved body details, exactly as the server
 * recomputes it, so the preview never differs from what gets stored.
 */
export function ChangePlanForm({ profile, active }: { profile: Profile; active: StoredPlan }) {
  const router = useRouter();
  const today = useMemo(() => dayKey(new Date()), []);
  const [goal, setGoal] = useState<Goal>(active.goal);
  const [goalWeightKg, setGoalWeightKg] = useState(
    active.goalWeightKg === null ? "" : String(active.goalWeightKg),
  );
  const [pending, startTransition] = useTransition();
  const body: BodyDetails = {
    sex: profile.sex,
    birthYear: profile.birthYear,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    activityLevel: profile.activityLevel,
  };
  const goalWeight = Number(goalWeightKg);
  const goalReady =
    goal === "maintain" ||
    (goalWeight >= 30 &&
      goalWeight <= 300 &&
      (goal === "lose" ? goalWeight < body.weightKg : goalWeight > body.weightKg));

  function submit(choice: PlanChoice) {
    startTransition(async () => {
      const result = await changePlanAction({
        goal,
        goalWeightKg: goal === "maintain" ? null : goalWeight,
        kgPerWeek: choice.kgPerWeek,
        proteinPerKg: choice.proteinPerKg,
        custom: choice.custom,
        today,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Plan changed. It starts today");
      router.push("/settings");
    });
  }

  return (
    <section aria-label="Change plan" className="flex flex-col gap-3.5">
      <h2 className="hidden text-[17px] font-extrabold lg:block">Change plan</h2>
      <Segmented
        value={goal}
        onChange={setGoal}
        options={[
          { value: "lose", label: "Lose" },
          { value: "maintain", label: "Maintain" },
          { value: "gain", label: "Gain" },
        ]}
      />
      {goal !== "maintain" && (
        <div>
          <Field
            label="Goal weight"
            unit="kg"
            value={goalWeightKg}
            onChange={setGoalWeightKg}
            inputMode="decimal"
          />
          {!goalReady && (
            <p className="mt-1.5 text-[13px] text-muted">
              Enter a weight {goal === "lose" ? "below" : "above"} {body.weightKg} kg to see the
              plans.
            </p>
          )}
        </div>
      )}
      <p className="rounded-panel bg-surface px-3.5 py-2.5 text-[13px] text-muted">
        The new plan <b className="text-foreground">starts today</b>. Earlier days keep the plan
        they were logged under.
      </p>
      {goalReady && (
        // Remounted when the goal changes, so the paces start fresh
        <PlanPicker
          key={`${goal}-${goal === "maintain" ? "" : goalWeight}`}
          body={body}
          goal={goal}
          goalWeightKg={goal === "maintain" ? null : goalWeight}
          today={today}
          pending={pending}
          onSubmit={submit}
        />
      )}
    </section>
  );
}
