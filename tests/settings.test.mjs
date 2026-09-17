import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-module.mjs";

const plan = loadModule("src/lib/plan.ts");

const today = new Date();
const pad = (n) => String(n).padStart(2, "0");
const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

const profile = {
  sex: "male",
  birthYear: 1999,
  heightCm: 190,
  weightKg: 70,
  activityLevel: "moderate",
  waterTracking: false,
  waterGoalMl: null,
};
// Expected numbers come from the same functions the app uses, so these tests
// keep passing as the years pass
const maintenance = plan.maintenanceCalories(profile, today.getFullYear());
const gainSteady = maintenance + (0.5 * 7700) / 7;

/** Loads the Settings actions with fake storage and a fake auth client. */
function settings({ userId = "user-1", stored = profile, auth = {} } = {}) {
  const saved = {};
  const loaded = loadModule("src/app/(app)/settings/actions.ts", {
    "next/cache": { revalidatePath: (path, type) => (saved.revalidated = [path, type]) },
    "@/lib/supabase-session": {
      getUserId: async () => userId,
      createSessionClient: async () => ({
        auth: {
          getUser: async () => ({ data: { user: { email: "me@example.com" } }, error: null }),
          signInWithPassword: async ({ password }) => {
            saved.signedInWith = password;
            return password === "correct-password" ? { error: null } : { error: { code: "bad" } };
          },
          updateUser: async ({ password }) => {
            saved.newPassword = password;
            return { error: null };
          },
          ...auth,
        },
      }),
    },
    "@/lib/profiles": {
      getProfile: async () => stored,
      saveProfile: async (id, body) => (saved.profile = { id, body }),
      saveWaterSetting: async (id, tracking, goalMl) => (saved.water = { id, tracking, goalMl }),
    },
    "@/lib/plan-history": { savePlan: async (id, p) => (saved.plan = { id, plan: p }) },
  });
  return { saved, ...loaded };
}

test("saving details stores them and leaves the targets alone", async () => {
  const { saved, saveDetailsAction } = settings();
  assert.deepEqual(await saveDetailsAction({ ...profile, weightKg: 72 }), {});
  assert.equal(saved.profile.body.weightKg, 72);
  assert.equal(saved.plan, undefined); // no new plan, so today's targets don't move
});

test("bad details are rejected with a message naming the field", async () => {
  const { saved, saveDetailsAction } = settings();
  assert.match((await saveDetailsAction({ ...profile, heightCm: 40 })).error, /height/);
  assert.equal(saved.profile, undefined);
});

test("water tracking needs a goal, and turning it off keeps working", async () => {
  const on = settings();
  assert.match((await on.saveWaterAction({ tracking: true, goalMl: null })).error, /water goal/);
  assert.equal(on.saved.water, undefined);

  assert.deepEqual(await on.saveWaterAction({ tracking: true, goalMl: 2450 }), {});
  assert.deepEqual(on.saved.water, { id: "user-1", tracking: true, goalMl: 2450 });
  assert.deepEqual(on.saved.revalidated, ["/", "layout"]);

  const off = settings();
  await off.saveWaterAction({ tracking: false, goalMl: null });
  assert.deepEqual(off.saved.water, { id: "user-1", tracking: false, goalMl: null });
});

test("changing plans uses the stored profile and recomputes the targets", async () => {
  const { saved, changePlanAction } = settings();
  assert.deepEqual(
    await changePlanAction({
      goal: "gain",
      goalWeightKg: 75,
      kgPerWeek: 0.5,
      custom: null,
      today: todayKey,
    }),
    {},
  );
  assert.deepEqual(saved.plan.plan, {
    effectiveFrom: todayKey, // the change starts today
    goal: "gain",
    kgPerWeek: 0.5,
    goalWeightKg: 75,
    calorieTarget: gainSteady,
    proteinTarget: 140, // 2.0 g × 70 kg from the stored profile
    maintenanceKcal: maintenance,
    weightKg: 70,
  });
});

test("a plan change can't smuggle in its own targets or an unoffered pace", async () => {
  const sneaky = settings();
  await sneaky.changePlanAction({
    goal: "gain",
    goalWeightKg: 75,
    kgPerWeek: 0.5,
    custom: { calorieTarget: 9000, proteinTarget: 400 },
    today: todayKey,
  });
  assert.equal(sneaky.saved.plan.plan.calorieTarget, gainSteady);

  const wrongPace = settings();
  assert.match(
    (
      await wrongPace.changePlanAction({
        goal: "gain",
        goalWeightKg: 75,
        kgPerWeek: 3,
        custom: null,
        today: todayKey,
      })
    ).error,
    /suggested plans/,
  );
  assert.equal(wrongPace.saved.plan, undefined);
});

test("a goal weight on the wrong side of the current weight is rejected", async () => {
  const { saved, changePlanAction } = settings();
  assert.match(
    (
      await changePlanAction({
        goal: "lose",
        goalWeightKg: 75, // above the stored 70 kg
        kgPerWeek: 0.5,
        custom: null,
        today: todayKey,
      })
    ).error,
    /below your current weight/,
  );
  assert.equal(saved.plan, undefined);
});

test("changing the password checks the current one first", async () => {
  const short = settings();
  assert.match((await short.changePasswordAction("correct-password", "abc")).error, /8 characters/);
  assert.equal(short.saved.newPassword, undefined);

  const wrong = settings();
  assert.match(
    (await wrong.changePasswordAction("nope", "a-long-new-password")).error,
    /isn’t right/,
  );
  assert.equal(wrong.saved.newPassword, undefined);

  const ok = settings();
  assert.deepEqual(await ok.changePasswordAction("correct-password", "a-long-new-password"), {
    ok: true,
  });
  assert.equal(ok.saved.newPassword, "a-long-new-password");
});

test("logged-out requests change nothing", async () => {
  const { saved, saveDetailsAction, saveWaterAction, changePlanAction } = settings({
    userId: null,
  });
  const expected = { error: "Authentication required" };
  assert.deepEqual(await saveDetailsAction(profile), expected);
  assert.deepEqual(await saveWaterAction({ tracking: true, goalMl: 2000 }), expected);
  assert.deepEqual(
    await changePlanAction({
      goal: "maintain",
      goalWeightKg: null,
      kgPerWeek: 0,
      custom: null,
      today: todayKey,
    }),
    expected,
  );
  assert.deepEqual(saved, {});
});
