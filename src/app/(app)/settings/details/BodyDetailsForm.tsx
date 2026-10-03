"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/Button";
import { Field, Segmented } from "@/components/fields";
import { ACTIVITY_LABELS, PinnedAction } from "@/components/PlanPicker";
import { dayKey, longDate } from "@/lib/day";
import { maintenanceCalories, type ActivityLevel, type BodyDetails, type Sex } from "@/lib/plan";
import type { Profile } from "@/lib/profiles";
import type { WeightEntry } from "@/lib/weights";
import { saveDetailsAction } from "../actions";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/**
 * The details behind the maintenance estimate. Saving them never changes the
 * plan's targets; the note says so, and Change plan is one tap away.
 */
export function BodyDetailsForm({
  profile,
  latestWeighIn,
  planWeightKg,
}: {
  profile: Profile;
  latestWeighIn: WeightEntry | null;
  /** The weight the current plan was built at */
  planWeightKg: number;
}) {
  const today = useMemo(() => dayKey(new Date()), []);
  const [sex, setSex] = useState<Sex>(profile.sex);
  const [birthYear, setBirthYear] = useState(String(profile.birthYear));
  const [heightCm, setHeightCm] = useState(String(profile.heightCm));
  // The latest weigh-in is the current weight; saving details stores it in the profile
  const weighInDiffers = latestWeighIn !== null && latestWeighIn.weightKg !== profile.weightKg;
  const [weightKg, setWeightKg] = useState(
    String(weighInDiffers ? latestWeighIn.weightKg : profile.weightKg),
  );
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(profile.activityLevel);
  const [pending, startTransition] = useTransition();

  const details: BodyDetails = {
    sex,
    birthYear: Number(birthYear),
    heightCm: Number(heightCm),
    weightKg: Number(weightKg),
    activityLevel,
  };
  const ready =
    Number(birthYear) > 1900 &&
    Number(heightCm) >= 100 &&
    Number(weightKg) >= 30 &&
    Number(weightKg) <= 300;
  const maintenanceNow = ready ? maintenanceCalories(details, Number(today.slice(0, 4))) : null;
  const dirty =
    sex !== profile.sex ||
    Number(birthYear) !== profile.birthYear ||
    Number(heightCm) !== profile.heightCm ||
    Number(weightKg) !== profile.weightKg ||
    activityLevel !== profile.activityLevel;

  function save() {
    startTransition(async () => {
      const result = await saveDetailsAction(details);
      if (result.error) toast.error(result.error);
      else toast.success("Details saved");
    });
  }

  return (
    <section aria-label="Body details" className="flex flex-col gap-3.5">
      <h2 className="hidden text-[17px] font-extrabold lg:block">Body details</h2>
      <Segmented
        value={sex}
        onChange={setSex}
        options={[
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
        ]}
      />
      <div className="grid grid-cols-3 gap-2">
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
      {weighInDiffers && Number(weightKg) === latestWeighIn.weightKg && (
        <p className="-mt-1.5 text-[12.5px] text-muted">
          Weight filled in from your weigh-in on {longDate(latestWeighIn.day)} (saved details say{" "}
          {profile.weightKg} kg).
        </p>
      )}
      <label className="block">
        <span className="mb-1.5 block text-[12.5px] font-semibold text-muted">Activity</span>
        <select
          value={activityLevel}
          onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
          className="h-12 w-full rounded-panel border-[1.5px] border-line bg-background px-3.5 text-[15px] text-foreground focus:border-accent focus:outline-none"
        >
          {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((level) => (
            <option key={level} value={level}>
              {ACTIVITY_LABELS[level]}
            </option>
          ))}
        </select>
      </label>
      {maintenanceNow !== null && (
        <div className="rounded-[20px] bg-surface px-4 py-3.5">
          <span className="block text-[12.5px] text-muted">Maintenance now</span>
          <span className="text-2xl font-extrabold tracking-tight tabular-nums">
            ≈ {fmt(maintenanceNow)} kcal
          </span>
        </div>
      )}
      {Number(weightKg) !== planWeightKg && (
        <div className="flex flex-col gap-2.5 rounded-panel bg-accent-soft px-3.5 py-3 text-[13px] text-muted">
          <p>
            Your plan was built at <b className="text-foreground">{planWeightKg} kg</b>. Your
            targets stay as they are until you change your plan.
          </p>
          <ButtonLink href="/settings/plan" variant="secondary" size="sm" className="self-start">
            Change plan
          </ButtonLink>
        </div>
      )}
      <PinnedAction>
        <Button className="w-full" pending={pending} disabled={!dirty || !ready} onClick={save}>
          {pending ? "Saving…" : "Save details"}
        </Button>
      </PinnedAction>
    </section>
  );
}
