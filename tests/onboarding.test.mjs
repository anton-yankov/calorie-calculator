import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-module.mjs";

const plan = loadModule("src/lib/plan.ts");

const today = new Date();
const pad = (n) => String(n).padStart(2, "0");
const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

const valid = {
  sex: "male",
  birthYear: 1999,
  heightCm: 180,
  weightKg: 85,
  activityLevel: "moderate",
  goal: "lose",
  goalWeightKg: 78,
  kgPerWeek: 0.5,
  custom: null,
  today: todayKey,
};

// Expected numbers come from the same functions the app uses, so these tests
// keep passing as the years pass (age is derived from the birth year)
const maintenance = plan.maintenanceCalories(valid, today.getFullYear());
const loseSteady = maintenance - (0.5 * 7700) / 7;

/** Loads the action with fake storage, recording what it would save. */
function onboarding({ userId = "user-1" } = {}) {
  const saved = {};
  const loaded = loadModule("src/app/onboarding/actions.ts", {
    "next/cache": { revalidatePath: (path, type) => (saved.revalidated = [path, type]) },
    "next/navigation": { redirect: (path) => (saved.redirect = path) },
    "@/lib/supabase-session": { getUserId: async () => userId },
    "@/lib/profiles": { saveProfile: async (id, profile) => (saved.profile = { id, profile }) },
    "@/lib/plan-history": { savePlan: async (id, plan) => (saved.plan = { id, plan }) },
  });
  return { saved, save: loaded.saveOnboardingAction };
}

test("a suggested pace is stored with server-computed targets and snapshots", async () => {
  const { saved, save } = onboarding();
  assert.deepEqual(await save(valid), undefined);
  assert.deepEqual(saved.profile, {
    id: "user-1",
    profile: {
      sex: "male",
      birthYear: 1999,
      heightCm: 180,
      weightKg: 85,
      activityLevel: "moderate",
    },
  });
  assert.deepEqual(saved.plan.plan, {
    effectiveFrom: todayKey,
    goal: "lose",
    kgPerWeek: 0.5,
    goalWeightKg: 78,
    calorieTarget: loseSteady, // recomputed here, not taken from the client
    proteinTarget: 170, // 2.0 g × 85 kg
    maintenanceKcal: maintenance,
    weightKg: 85,
  });
  assert.deepEqual(saved.revalidated, ["/", "layout"]);
  assert.equal(saved.redirect, "/");
});

test("client-sent calorie targets can't override a suggested pace", async () => {
  const { saved, save } = onboarding();
  await save({ ...valid, custom: { calorieTarget: 5000, proteinTarget: 400 } });
  assert.equal(saved.plan.plan.calorieTarget, loseSteady);
});

test("a pace that isn't offered is rejected", async () => {
  const { saved, save } = onboarding();
  assert.deepEqual(await save({ ...valid, kgPerWeek: 2 }), {
    error: "Choose one of the suggested plans.",
  });
  assert.equal(saved.plan, undefined);
});

test("custom targets are stored as typed, within bounds", async () => {
  const { saved, save } = onboarding();
  await save({ ...valid, kgPerWeek: null, custom: { calorieTarget: 2400, proteinTarget: 165 } });
  assert.equal(saved.plan.plan.calorieTarget, 2400);
  assert.equal(saved.plan.plan.proteinTarget, 165);
  assert.equal(saved.plan.plan.kgPerWeek, null);

  const tooLow = onboarding();
  assert.match(
    (
      await tooLow.save({
        ...valid,
        kgPerWeek: null,
        custom: { calorieTarget: 100, proteinTarget: 5 },
      })
    ).error,
    /Enter calories/,
  );
  assert.equal(tooLow.saved.plan, undefined);
});

test("custom targets that can't reach the goal are still allowed", async () => {
  const { saved, save } = onboarding();
  // 3000 kcal is above maintenance while losing: the form warns, the user decides
  await save({ ...valid, kgPerWeek: null, custom: { calorieTarget: 3000, proteinTarget: 170 } });
  assert.equal(saved.plan.plan.calorieTarget, 3000);
});

test("maintaining stores no goal weight", async () => {
  const { saved, save } = onboarding();
  await save({ ...valid, goal: "maintain", goalWeightKg: 80, kgPerWeek: 0 });
  assert.equal(saved.plan.plan.goalWeightKg, null);
  assert.equal(saved.plan.plan.calorieTarget, maintenance);
});

test("nonsense input is rejected before anything is saved", async () => {
  const cases = [
    [{ heightCm: 40 }, /height/],
    [{ weightKg: 500 }, /weight between/],
    [{ birthYear: 2025 }, /birth year/],
    [{ sex: "other" }, /male or female/],
    [{ activityLevel: "olympian" }, /activity level/],
    [{ goal: "shrink" }, /Choose a goal/],
    [{ goalWeightKg: 95 }, /below your current weight/],
    [{ today: "2020-01-01" }, /Invalid date/],
    [{ today: "not-a-date" }, /Invalid date/],
  ];
  for (const [patch, expected] of cases) {
    const { saved, save } = onboarding();
    const result = await save({ ...valid, ...patch });
    assert.match(result.error, expected, JSON.stringify(patch));
    assert.equal(saved.plan, undefined);
    assert.equal(saved.profile, undefined);
  }
});

test("logged-out setup saves nothing", async () => {
  const { saved, save } = onboarding({ userId: null });
  assert.deepEqual(await save(valid), { error: "Authentication required" });
  assert.equal(saved.profile, undefined);
});
