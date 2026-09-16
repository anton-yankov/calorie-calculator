import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-module.mjs";

const { planForDay, targetsForDay } = loadModule("src/lib/plan-targets.ts");

const plan = (effectiveFrom, calorieTarget, goal = "lose") => ({
  effectiveFrom,
  goal,
  kgPerWeek: 0.5,
  goalWeightKg: goal === "maintain" ? null : 78,
  calorieTarget,
  proteinTarget: 170,
  maintenanceKcal: 2860,
  weightKg: 85,
});

// Oldest first, the order listPlans returns
const plans = [plan("2026-09-16", 2310), plan("2026-10-01", 2500, "maintain")];

test("a day uses the newest plan starting on or before it", () => {
  assert.equal(planForDay(plans, "2026-09-16").calorieTarget, 2310); // the start day itself
  assert.equal(planForDay(plans, "2026-09-30").calorieTarget, 2310);
  assert.equal(planForDay(plans, "2026-10-01").calorieTarget, 2500); // switches on its start day
  assert.equal(planForDay(plans, "2027-05-01").calorieTarget, 2500); // stays on the latest
});

test("days before the first plan fall back to the oldest plan", () => {
  // Meals logged before setup keep their bars instead of going blank
  assert.equal(planForDay(plans, "2026-01-01").calorieTarget, 2310);
});

test("no plans means no targets", () => {
  assert.equal(planForDay([], "2026-09-16"), null);
  assert.equal(targetsForDay([], "2026-09-16", 2000), null);
});

test("targets carry the day's goal, its numbers and the water goal", () => {
  assert.deepEqual(targetsForDay(plans, "2026-09-20", 2500), {
    goal: "lose",
    calorieTarget: 2310,
    proteinTarget: 170,
    waterGoalMl: 2500,
  });
  assert.deepEqual(targetsForDay(plans, "2026-10-05", null), {
    goal: "maintain",
    calorieTarget: 2500,
    proteinTarget: 170,
    waterGoalMl: null,
  });
});
