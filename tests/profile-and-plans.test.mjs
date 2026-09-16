import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-module.mjs";

/** A fake session client that records every query and answers selects with `rows`. */
function fakeDb(rows) {
  const calls = [];
  const query = (table) => ({
    select: (columns) => {
      const call = { table, columns, filters: [] };
      calls.push(call);
      const chain = {
        eq: (column, value) => (call.filters.push([column, value]), chain),
        limit: (n) => ((call.limit = n), chain),
        order: async (column, options) => (
          (call.order = [column, options]),
          { data: rows, error: null }
        ),
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      };
      return chain;
    },
    upsert: async (row, options) => (calls.push({ table, row, options }), { error: null }),
  });
  return {
    calls,
    mocks: { "@/lib/supabase-session": { createSessionClient: async () => ({ from: query }) } },
  };
}

const body = {
  sex: "male",
  birthYear: 1999,
  heightCm: 180,
  weightKg: 85,
  activityLevel: "moderate",
};
const bodyRow = {
  sex: "male",
  birth_year: 1999,
  height_cm: 180,
  weight_kg: 85,
  activity_level: "moderate",
};

test("profiles are read and saved for the given user only", async () => {
  const db = fakeDb([{ ...bodyRow, water_tracking: true, water_goal_ml: 2500 }]);
  const profiles = loadModule("src/lib/profiles.ts", db.mocks);
  assert.deepEqual(await profiles.getProfile("user-1"), {
    ...body,
    waterTracking: true,
    waterGoalMl: 2500,
  });
  assert.deepEqual(db.calls[0].filters, [["user_id", "user-1"]]);

  // Saving sends the body columns only, so the water setting survives an edit
  await profiles.saveProfile("user-1", body);
  assert.deepEqual(db.calls[1].row, { ...bodyRow, user_id: "user-1" });
});

test("a user without a profile gets null, not an error", async () => {
  const profiles = loadModule("src/lib/profiles.ts", fakeDb([]).mocks);
  assert.equal(await profiles.getProfile("user-1"), null);
});

test("the water goal only counts while water tracking is on", async () => {
  const profiles = loadModule("src/lib/profiles.ts", fakeDb([]).mocks);
  assert.equal(profiles.activeWaterGoal({ ...body, waterTracking: true, waterGoalMl: 2500 }), 2500);
  assert.equal(
    profiles.activeWaterGoal({ ...body, waterTracking: false, waterGoalMl: 2500 }),
    null,
  );
  assert.equal(profiles.activeWaterGoal(null), null);
});

const storedPlan = {
  effectiveFrom: "2026-09-16",
  goal: "lose",
  kgPerWeek: 0.5,
  goalWeightKg: 78,
  calorieTarget: 2310,
  proteinTarget: 170,
  maintenanceKcal: 2860,
  weightKg: 85,
};
const planRow = {
  effective_from: "2026-09-16",
  goal: "lose",
  kg_per_week: 0.5,
  goal_weight_kg: 78,
  calorie_target: 2310,
  protein_target: 170,
  maintenance_kcal: 2860,
  weight_kg: 85,
};

test("plans are listed oldest first for the given user", async () => {
  const db = fakeDb([planRow]);
  const history = loadModule("src/lib/plan-history.ts", db.mocks);
  assert.deepEqual(await history.listPlans("user-1"), [storedPlan]);
  assert.deepEqual(db.calls[0].filters, [["user_id", "user-1"]]);
  assert.deepEqual(db.calls[0].order, ["effective_from", { ascending: true }]);
});

test("saving a plan upserts on user and start date, so a same-day change replaces it", async () => {
  const db = fakeDb([]);
  const history = loadModule("src/lib/plan-history.ts", db.mocks);
  await history.savePlan("user-1", storedPlan);
  assert.deepEqual(db.calls[0].row, { ...planRow, user_id: "user-1" });
  assert.deepEqual(db.calls[0].options, { onConflict: "user_id,effective_from" });
});

test("hasPlan reports whether onboarding is done, asking for one row only", async () => {
  const onboarded = fakeDb([planRow]);
  assert.equal(
    await loadModule("src/lib/plan-history.ts", onboarded.mocks).hasPlan("user-1"),
    true,
  );
  assert.deepEqual(onboarded.calls[0].filters, [["user_id", "user-1"]]);
  assert.equal(onboarded.calls[0].limit, 1);

  const fresh = fakeDb([]);
  assert.equal(await loadModule("src/lib/plan-history.ts", fresh.mocks).hasPlan("user-1"), false);
});
