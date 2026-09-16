"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { logout } from "@/app/login/actions";
import { Field, Segmented } from "@/components/fields";
import { ACTIVITY_LABELS, PlanPicker, type PlanChoice } from "@/components/PlanPicker";
import { Spinner } from "@/components/loaders";
import { addDays, dayKey, longDate } from "@/lib/day";
import {
  maintenanceCalories,
  paceFromCalories,
  type ActivityLevel,
  type BodyDetails,
  type Goal,
  type Sex,
} from "@/lib/plan";
import type { StoredPlan } from "@/lib/plan-history";
import type { Profile } from "@/lib/profiles";
import type { WeightEntry } from "@/lib/weights";
import { formatWater } from "@/lib/water";
import {
  changePasswordAction,
  changePlanAction,
  saveDetailsAction,
  saveWaterAction,
} from "./actions";

const GOAL_LABELS: Record<Goal, string> = {
  lose: "Lose weight",
  maintain: "Maintain weight",
  gain: "Gain weight",
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** About 35 ml per kg — a common rule of thumb, and only a starting point. */
const suggestedWaterGoal = (weightKg: number) => Math.round((weightKg * 35) / 50) * 50;

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

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{children}</h2>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="font-mono text-[13.5px] tabular-nums">{value}</span>
    </div>
  );
}

function SaveButton({
  pending,
  label,
  onClick,
  variant = "ghost",
}: {
  pending: boolean;
  label: string;
  onClick: () => void;
  variant?: "ghost" | "accent";
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-panel px-4 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        variant === "accent"
          ? "bg-accent text-background"
          : "border border-line text-foreground hover:border-muted/60"
      }`}
    >
      {pending && <Spinner />}
      {pending ? "Saving…" : label}
    </button>
  );
}

export function SettingsView({
  email,
  profile,
  plans,
  latestWeighIn,
  isAdmin,
}: {
  email: string;
  isAdmin: boolean;
  profile: Profile;
  plans: StoredPlan[];
  latestWeighIn: WeightEntry | null;
}) {
  const today = useMemo(() => dayKey(new Date()), []);
  const active = plans[plans.length - 1];

  // Details
  const [sex, setSex] = useState<Sex>(profile.sex);
  const [birthYear, setBirthYear] = useState(String(profile.birthYear));
  const [heightCm, setHeightCm] = useState(String(profile.heightCm));
  // The latest weigh-in is the current weight; saving details stores it in the profile
  const weighInIsNewer = latestWeighIn !== null && latestWeighIn.weightKg !== profile.weightKg;
  const [weightKg, setWeightKg] = useState(
    String(weighInIsNewer ? latestWeighIn.weightKg : profile.weightKg),
  );
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(profile.activityLevel);
  const [savingDetails, saveDetails] = useTransition();

  // Plan change
  const [changing, setChanging] = useState(false);
  const [goal, setGoal] = useState<Goal>(active?.goal ?? "maintain");
  const [goalWeightKg, setGoalWeightKg] = useState(
    active?.goalWeightKg === null || active === undefined ? "" : String(active.goalWeightKg),
  );
  const [savingPlan, savePlanChange] = useTransition();

  // Water
  const [waterOn, setWaterOn] = useState(profile.waterTracking);
  const [waterGoal, setWaterGoal] = useState(
    profile.waterGoalMl === null ? "" : String(profile.waterGoalMl),
  );
  const [savingWater, saveWater] = useTransition();

  // Password
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, savePassword] = useTransition();

  const details: BodyDetails = {
    sex,
    birthYear: Number(birthYear),
    heightCm: Number(heightCm),
    weightKg: Number(weightKg),
    activityLevel,
  };
  const detailsReady =
    Number(birthYear) > 1900 &&
    Number(heightCm) >= 100 &&
    Number(weightKg) >= 30 &&
    Number(weightKg) <= 300;
  const maintenanceNow = detailsReady
    ? maintenanceCalories(details, Number(today.slice(0, 4)))
    : null;
  const weightMovedFromPlan = active !== undefined && Number(weightKg) !== active.weightKg;

  const goalWeight = Number(goalWeightKg);
  const planGoalReady =
    goal === "maintain" ||
    (goalWeight >= 30 &&
      goalWeight <= 300 &&
      (goal === "lose" ? goalWeight < details.weightKg : goalWeight > details.weightKg));

  const summary = active ? planSummary(active) : null;

  function onSaveDetails() {
    saveDetails(async () => {
      const result = await saveDetailsAction(details);
      if (result.error) toast.error(result.error);
      else toast.success("Details saved");
    });
  }

  function onChangePlan(choice: PlanChoice) {
    savePlanChange(async () => {
      const result = await changePlanAction({
        goal,
        goalWeightKg: goal === "maintain" ? null : goalWeight,
        kgPerWeek: choice.kgPerWeek,
        custom: choice.custom,
        today,
      });
      if (result.error) toast.error(result.error);
      else {
        toast.success("Plan updated — it starts today");
        setChanging(false);
      }
    });
  }

  function onSaveWater() {
    saveWater(async () => {
      const goalMl = waterGoal.trim() === "" ? null : Math.round(Number(waterGoal));
      const result = await saveWaterAction({ tracking: waterOn, goalMl });
      if (result.error) toast.error(result.error);
      else toast.success(waterOn ? "Water tracking on" : "Water tracking off");
    });
  }

  function onChangePassword() {
    savePassword(async () => {
      const result = await changePasswordAction(currentPassword, newPassword);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Password changed");
        setPasswordOpen(false);
        setCurrentPassword("");
        setNewPassword("");
      }
    });
  }

  return (
    <main className="page-enter mx-auto flex w-full max-w-md flex-1 flex-col gap-7 px-5 pb-16 pt-8 sm:px-6 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:content-start lg:items-start lg:gap-x-10 lg:gap-y-7">
      <header className="border-b-2 border-foreground pb-5 lg:col-span-2">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">
          Your account
        </p>
        <h1 className="font-serif text-[clamp(1.9rem,7vw,2.5rem)] font-semibold leading-[1.08] tracking-tight">
          Settings
        </h1>
      </header>

      <div className={`flex flex-col gap-7 ${changing ? "" : "lg:sticky lg:top-24"}`}>
        <section className="flex flex-col gap-3">
          <SectionTitle>Your plan</SectionTitle>
          {active && summary ? (
            <div className="rounded-panel border border-line bg-surface px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-bold">
                  {GOAL_LABELS[active.goal]}
                  {active.kgPerWeek === null && " · your own numbers"}
                </span>
                <span className="rounded-full border border-success px-2 py-px text-[10px] font-bold uppercase tracking-[0.08em] text-success">
                  Active
                </span>
              </div>
              <div className="mt-2 flex gap-4">
                <span>
                  <span className="font-mono text-xl font-bold tabular-nums">
                    {fmt(active.calorieTarget)}
                  </span>
                  <span className="ml-1 text-[11.5px] text-muted">kcal</span>
                </span>
                <span>
                  <span className="font-mono text-xl font-bold tabular-nums">
                    {active.proteinTarget}
                  </span>
                  <span className="ml-1 text-[11.5px] text-muted">g protein</span>
                </span>
              </div>
              <div className="mt-2.5 flex flex-col gap-1.5">
                <Row
                  label="Pace"
                  value={
                    active.goal === "maintain"
                      ? "± 0 kg/wk"
                      : `${summary.signedPace < 0 ? "−" : "+"}${Math.abs(summary.signedPace).toFixed(2)} kg/wk`
                  }
                />
                {active.goalWeightKg !== null && (
                  <Row label="Goal weight" value={`${active.goalWeightKg} kg`} />
                )}
                {summary.goalDate && <Row label="Goal date" value={longDate(summary.goalDate)} />}
                {!summary.reachable && (
                  <p className="text-[12.5px] text-danger">
                    These calories don&apos;t move you toward your goal weight.
                  </p>
                )}
                <Row label="Started" value={longDate(active.effectiveFrom)} />
                <Row label="Maintenance then" value={`${fmt(active.maintenanceKcal)} kcal`} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">No plan yet.</p>
          )}

          <button
            type="button"
            onClick={() => setChanging(!changing)}
            className="rounded-panel border border-line px-4 py-3 font-semibold transition hover:border-muted/60"
          >
            {changing ? "Keep my current plan" : "Change plan"}
          </button>

          {changing && (
            <div className="flex flex-col gap-3 rounded-panel border border-line bg-surface px-3.5 py-3">
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-muted">Goal</span>
                <Segmented
                  value={goal}
                  onChange={setGoal}
                  options={[
                    { value: "lose", label: "Lose" },
                    { value: "maintain", label: "Maintain" },
                    { value: "gain", label: "Gain" },
                  ]}
                />
              </div>
              {goal !== "maintain" && (
                <Field
                  label="Goal weight"
                  unit="kg"
                  value={goalWeightKg}
                  onChange={setGoalWeightKg}
                  inputMode="decimal"
                />
              )}
              <p className="rounded-r-panel border-l-4 border-accent bg-accent-soft px-3 py-2 text-[12.5px]">
                Starts today. Earlier days keep the plan they were logged under.
              </p>
              {planGoalReady && detailsReady ? (
                <PlanPicker
                  body={details}
                  goal={goal}
                  goalWeightKg={goal === "maintain" ? null : goalWeight}
                  today={today}
                  submitLabel="Start this plan"
                  pending={savingPlan}
                  onSubmit={onChangePlan}
                />
              ) : (
                <p className="text-xs text-muted">
                  Enter a goal weight {goal === "lose" ? "below" : "above"} {details.weightKg} kg to
                  see the plans.
                </p>
              )}
            </div>
          )}

          {plans.length > 1 && (
            <details>
              <summary className="cursor-pointer text-[13px] font-semibold text-accent">
                Plan history ({plans.length})
              </summary>
              <div className="mt-2 flex flex-col divide-y divide-line">
                {[...plans].reverse().map((plan, index, all) => {
                  const next = all[index - 1];
                  const until = next ? longDate(addDays(next.effectiveFrom, -1)) : "now";
                  return (
                    <div
                      key={plan.effectiveFrom}
                      className="flex justify-between gap-3 py-2 text-[12.5px] text-muted"
                    >
                      <span>
                        {longDate(plan.effectiveFrom)} → {until}
                      </span>
                      <span>
                        <b className="font-semibold text-foreground">{GOAL_LABELS[plan.goal]}</b> ·{" "}
                        {fmt(plan.calorieTarget)} kcal
                      </span>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </section>
      </div>

      <div className="flex flex-col gap-7">
        <section className="flex flex-col gap-3">
          <SectionTitle>Your details</SectionTitle>
          <Segmented
            value={sex}
            onChange={setSex}
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
            ]}
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
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
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted">Activity level</span>
            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
              className="w-full rounded-panel border border-line bg-surface px-4 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
            >
              {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((level) => (
                <option key={level} value={level}>
                  {ACTIVITY_LABELS[level]}
                </option>
              ))}
            </select>
          </label>
          {weighInIsNewer && Number(weightKg) === latestWeighIn.weightKg && (
            <p className="text-xs text-muted">
              Weight from your weigh-in on {longDate(latestWeighIn.day)} (saved details say{" "}
              {profile.weightKg} kg). Save details to use it.
            </p>
          )}
          {maintenanceNow !== null && (
            <Row label="Maintenance now" value={`${fmt(maintenanceNow)} kcal`} />
          )}
          {weightMovedFromPlan && active && (
            <p className="rounded-r-panel border-l-4 border-accent bg-accent-soft px-3 py-2 text-[12.5px]">
              Your plan was built at {active.weightKg} kg. Change your plan to use the new weight —
              your targets stay as they are until you do.
            </p>
          )}
          <SaveButton pending={savingDetails} label="Save details" onClick={onSaveDetails} />
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle>Water</SectionTitle>
          <div className="rounded-panel border border-line bg-surface px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold">Track water</span>
                <span className="block text-xs text-muted">
                  Drinks always count as food; this adds the water bar and stats.
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={waterOn}
                aria-label="Track water"
                onClick={() => {
                  const next = !waterOn;
                  setWaterOn(next);
                  if (next && waterGoal.trim() === "") {
                    setWaterGoal(String(suggestedWaterGoal(Number(weightKg) || profile.weightKg)));
                  }
                }}
                className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
                  waterOn ? "border-accent bg-accent-soft" : "border-line bg-background"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute top-[2px] h-[18px] w-[18px] rounded-full transition-all ${
                    waterOn ? "left-[22px] bg-accent" : "left-[2px] bg-muted"
                  }`}
                />
              </button>
            </div>
            {waterOn && (
              <div className="mt-3">
                <Field
                  label="Daily water goal"
                  unit="ml"
                  value={waterGoal}
                  onChange={setWaterGoal}
                />
                <p className="mt-1.5 text-xs text-muted">
                  Suggested for {Number(weightKg) || profile.weightKg} kg:{" "}
                  {formatWater(suggestedWaterGoal(Number(weightKg) || profile.weightKg))} (35 ml per
                  kg).
                </p>
              </div>
            )}
          </div>
          <SaveButton pending={savingWater} label="Save water setting" onClick={onSaveWater} />
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle>Account</SectionTitle>
          <div className="rounded-panel border border-line bg-surface px-4 py-3">
            <Row label="Email" value={email} />
          </div>
          <button
            type="button"
            onClick={() => setPasswordOpen(!passwordOpen)}
            className="rounded-panel border border-line px-4 py-3 font-semibold transition hover:border-muted/60"
          >
            {passwordOpen ? "Cancel password change" : "Change password"}
          </button>
          {passwordOpen && (
            <div className="flex flex-col gap-3 rounded-panel border border-line bg-surface px-3.5 py-3">
              <Field
                label="Current password"
                type="password"
                inputMode="text"
                autoComplete="current-password"
                value={currentPassword}
                onChange={setCurrentPassword}
              />
              <Field
                label="New password"
                type="password"
                inputMode="text"
                autoComplete="new-password"
                value={newPassword}
                onChange={setNewPassword}
              />
              <p className="text-xs text-muted">
                At least 8 characters. You stay logged in on this device.
              </p>
              <SaveButton
                pending={savingPassword}
                label="Update password"
                variant="accent"
                onClick={onChangePassword}
              />
            </div>
          )}
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-panel border border-danger px-4 py-3 font-semibold text-danger transition hover:bg-danger-soft"
            >
              Log out
            </button>
          </form>
        </section>

        {isAdmin && (
          <section className="flex flex-col gap-3">
            <SectionTitle>Admin</SectionTitle>
            <Link
              href="/admin"
              className="rounded-panel border border-line px-4 py-3 text-center font-semibold text-accent transition hover:border-accent"
            >
              Users and AI caps
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
