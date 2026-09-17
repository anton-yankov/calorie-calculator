"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Choice, Field, Segmented } from "@/components/fields";
import { ACTIVITY_LABELS, PlanPicker, type PlanChoice } from "@/components/PlanPicker";
import { dayKey } from "@/lib/day";
import type { ActivityLevel, BodyDetails, Goal, Sex } from "@/lib/plan";
import { saveOnboardingAction } from "./actions";

const ACTIVITY_HINTS: Record<ActivityLevel, string> = {
  sedentary: "Desk job, little or no exercise",
  light: "Exercise 1–3 days a week",
  moderate: "Exercise 3–5 days a week",
  very: "Hard exercise 6–7 days a week",
  extra: "Very hard training or a physical job",
};

const GOAL_CHOICES: { value: Goal; label: string; hint: string }[] = [
  { value: "lose", label: "Lose weight", hint: "Eat a little under maintenance" },
  { value: "maintain", label: "Maintain weight", hint: "Eat around maintenance" },
  { value: "gain", label: "Gain weight", hint: "Eat a little over maintenance" },
];

/** "5.3" rather than float noise like "5.299999999999997". */
const kgText = (kg: number) => kg.toLocaleString("en-US", { maximumFractionDigits: 1 });

export function OnboardingFlow({ profile }: { profile: BodyDetails | null }) {
  const [step, setStep] = useState(1);
  const [sex, setSex] = useState<Sex>(profile?.sex ?? "male");
  const [birthYear, setBirthYear] = useState(profile ? String(profile.birthYear) : "");
  const [heightCm, setHeightCm] = useState(profile ? String(profile.heightCm) : "");
  const [weightKg, setWeightKg] = useState(profile ? String(profile.weightKg) : "");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    profile?.activityLevel ?? "moderate",
  );
  const [goal, setGoal] = useState<Goal>("lose");
  const [goalWeightKg, setGoalWeightKg] = useState("");
  const [pending, startTransition] = useTransition();

  // "Today" comes from the browser: only it knows the viewer's timezone
  const today = useMemo(() => dayKey(new Date()), []);
  const year = Number(birthYear);
  const height = Number(heightCm);
  const weight = Number(weightKg);
  const goalWeight = Number(goalWeightKg);

  const bodyReady =
    Number.isInteger(year) &&
    year > 1900 &&
    height >= 100 &&
    height <= 250 &&
    weight >= 30 &&
    weight <= 300;
  const goalReady =
    goal === "maintain" ||
    (goalWeight >= 30 &&
      goalWeight <= 300 &&
      (goal === "lose" ? goalWeight < weight : goalWeight > weight));

  const body: BodyDetails = {
    sex,
    birthYear: year,
    heightCm: height,
    weightKg: weight,
    activityLevel,
  };

  function start(choice: PlanChoice) {
    startTransition(async () => {
      const result = await saveOnboardingAction({
        ...body,
        goal,
        goalWeightKg: goal === "maintain" ? null : goalWeight,
        kgPerWeek: choice.kgPerWeek,
        custom: choice.custom,
        today,
      });
      // On success the action redirects, so only errors come back
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <main className="page-enter mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 pb-16 pt-8 sm:px-6">
      <div className="flex gap-1.5" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`h-1 flex-1 rounded-full ${n <= step ? "bg-accent" : "bg-line"}`}
          />
        ))}
      </div>

      <header className="border-b-2 border-foreground pb-5">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">
          Step {step} of 3
        </p>
        <h1 className="font-serif text-[clamp(1.9rem,7vw,2.5rem)] font-semibold leading-[1.08] tracking-tight">
          {step === 1 ? "Tell us about you" : step === 2 ? "What's your goal?" : "Pick your plan"}
        </h1>
        {step === 1 && (
          <p className="mt-2 text-[15px] text-muted">
            We use this to estimate how many calories your body burns in a day.
          </p>
        )}
      </header>

      {step === 1 && (
        <>
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-muted">Sex</span>
            <Segmented
              value={sex}
              onChange={setSex}
              options={[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Birth year" value={birthYear} onChange={setBirthYear} />
            <Field label="Height" unit="cm" value={heightCm} onChange={setHeightCm} />
            <Field
              label="Weight"
              unit="kg"
              value={weightKg}
              onChange={setWeightKg}
              inputMode="decimal"
            />
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-muted">
              How active are you?
            </span>
            <div className="flex flex-col gap-2">
              {(Object.keys(ACTIVITY_HINTS) as ActivityLevel[]).map((level) => (
                <Choice
                  key={level}
                  selected={activityLevel === level}
                  label={ACTIVITY_LABELS[level]}
                  hint={ACTIVITY_HINTS[level]}
                  onSelect={() => setActivityLevel(level)}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={!bodyReady}
            onClick={() => setStep(2)}
            className="rounded-panel bg-accent px-4 py-3 font-semibold text-background transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <div className="flex flex-col gap-2">
            {GOAL_CHOICES.map((choice) => (
              <Choice
                key={choice.value}
                selected={goal === choice.value}
                label={choice.label}
                hint={choice.hint}
                onSelect={() => setGoal(choice.value)}
              />
            ))}
          </div>
          {goal === "maintain" ? (
            <p className="text-xs text-muted">
              No goal weight needed: we&apos;ll aim to keep you at {weightKg} kg.
            </p>
          ) : (
            <div>
              <Field
                label="Goal weight"
                unit="kg"
                value={goalWeightKg}
                onChange={setGoalWeightKg}
                inputMode="decimal"
              />
              <p className="mt-1.5 text-xs text-muted">
                {goalReady
                  ? `${kgText(Math.abs(weight - goalWeight))} kg to ${goal} from ${weight} kg`
                  : `Enter a weight ${goal === "lose" ? "below" : "above"} ${weight} kg`}
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-panel border border-line px-4 py-3 font-semibold text-muted"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!goalReady}
              onClick={() => setStep(3)}
              className="flex-1 rounded-panel bg-accent px-4 py-3 font-semibold text-background transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <PlanPicker
            body={body}
            goal={goal}
            goalWeightKg={goal === "maintain" ? null : goalWeight}
            today={today}
            submitLabel="Start this plan"
            pending={pending}
            onSubmit={start}
          />
          <button
            type="button"
            onClick={() => setStep(2)}
            className="self-start rounded-panel border border-line px-4 py-3 font-semibold text-muted"
          >
            Back
          </button>
        </>
      )}
    </main>
  );
}
