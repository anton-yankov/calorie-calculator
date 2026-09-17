import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-module.mjs";

const plan = loadModule("src/lib/plan.ts");

const man = {
  sex: "male",
  birthYear: 1999,
  heightCm: 180,
  weightKg: 85,
  activityLevel: "moderate",
};
const woman = {
  sex: "female",
  birthYear: 1996,
  heightCm: 165,
  weightKg: 65,
  activityLevel: "light",
};

test("BMR follows Mifflin-St Jeor for both sexes", () => {
  // 10×85 + 6.25×180 − 5×27 + 5
  assert.equal(plan.bmr(man, 2026), 1845);
  // 10×65 + 6.25×165 − 5×30 − 161
  assert.equal(plan.bmr(woman, 2026), 1370.25);
});

test("maintenance is BMR × activity factor, rounded to whole kcal", () => {
  assert.equal(plan.maintenanceCalories(man, 2026), 2860); // 1845 × 1.55 = 2859.75
  assert.equal(plan.maintenanceCalories(woman, 2026), 1884); // 1370.25 × 1.375 = 1884.09
});

test("more activity always means higher maintenance", () => {
  const levels = ["sedentary", "light", "moderate", "very", "extra"];
  const values = levels.map((activityLevel) =>
    plan.maintenanceCalories({ ...man, activityLevel }, 2026),
  );
  assert.deepEqual(
    values,
    [...values].sort((a, b) => a - b),
  );
  assert.equal(new Set(values).size, levels.length);
});

test("a year older lowers BMR by 5 kcal", () => {
  assert.equal(plan.bmr(man, 2027), plan.bmr(man, 2026) - 5);
});

const today = "2026-09-16";

test("losing offers three paces below maintenance with goal dates", () => {
  const plans = plan.suggestPlans(man, "lose", 78, today);
  // Maintenance 2860; a pace of p kg/week is p × 7700 ÷ 7 kcal a day (0.5 → 550)
  assert.deepEqual(
    plans.map((p) => [p.name, p.kgPerWeek, p.calorieTarget, p.goalDate]),
    [
      ["Gentle", 0.25, 2585, "2027-03-31"], // 7 kg ÷ 0.25 = 28 weeks
      ["Steady", 0.5, 2310, "2026-12-23"], // 14 weeks
      ["Faster", 0.75, 2035, "2026-11-20"], // 9.33 weeks ≈ 65 days
    ],
  );
  assert.deepEqual(
    plans.map((p) => p.weeksToGoal),
    [28, 14, 7 / 0.75],
  );
  assert.ok(plans.every((p) => p.proteinTarget === 170)); // 2.0 g × 85 kg
});

test("gaining offers two paces above maintenance", () => {
  const plans = plan.suggestPlans(man, "gain", 90, today);
  assert.deepEqual(
    plans.map((p) => [p.name, p.kgPerWeek, p.calorieTarget, p.goalDate]),
    [
      ["Lean", 0.25, 3135, "2027-02-03"], // 5 kg ÷ 0.25 = 20 weeks
      ["Steady", 0.5, 3410, "2026-11-25"], // 10 weeks
    ],
  );
});

test("maintaining is one plan at maintenance with no goal date", () => {
  assert.deepEqual(plan.suggestPlans(man, "maintain", null, today), [
    {
      name: "Maintain",
      kgPerWeek: 0,
      recommended: true,
      calorieTarget: 2860,
      proteinTarget: 170,
      weeksToGoal: null,
      goalDate: null,
    },
  ]);
});

test("each goal recommends exactly one plan", () => {
  const recommended = (goal, goalWeight) =>
    plan
      .suggestPlans(man, goal, goalWeight, today)
      .filter((p) => p.recommended)
      .map((p) => p.name);
  assert.deepEqual(recommended("lose", 78), ["Steady"]);
  assert.deepEqual(recommended("maintain", null), ["Maintain"]);
  assert.deepEqual(recommended("gain", 90), ["Lean"]);
});

test("your own calories below maintenance reach a lose goal on a recalculated date", () => {
  const outlook = plan.customPlanOutlook(man, "lose", 78, 2400, today);
  // 460 kcal a day under 2860 → 460 × 7 ÷ 7700 ≈ 0.42 kg/week → 7 kg in ≈ 16.7 weeks (117 days)
  assert.equal(outlook.kind, "reachable");
  assert.equal(outlook.kgPerWeek.toFixed(2), "0.42");
  assert.equal(outlook.goalDate, "2027-01-11");
});

test("calories that don't move toward the goal are impossible", () => {
  const impossible = { kind: "impossible" };
  assert.deepEqual(plan.customPlanOutlook(man, "lose", 78, 3000, today), impossible);
  assert.deepEqual(plan.customPlanOutlook(man, "lose", 78, 2860, today), impossible); // exactly maintenance
  assert.deepEqual(plan.customPlanOutlook(man, "gain", 90, 2500, today), impossible);
  // 340 kcal a day over → 5 kg in ≈ 16.2 weeks (113 days)
  assert.equal(plan.customPlanOutlook(man, "gain", 90, 3200, today).goalDate, "2027-01-07");
});

test("maintaining with your own calories reports the weekly change", () => {
  assert.deepEqual(plan.customPlanOutlook(man, "maintain", null, 2860, today), {
    kind: "maintain",
    weeklyChangeKg: 0,
  });
  // 360 kcal a day under → about a third of a kilo lost per week
  const under = plan.customPlanOutlook(man, "maintain", null, 2500, today);
  assert.equal(under.weeklyChangeKg.toFixed(2), "-0.33");
});

test("typing a suggested plan's calories gives that plan's goal date", () => {
  for (const [goal, goalWeight] of [
    ["lose", 78],
    ["gain", 90],
  ]) {
    for (const suggested of plan.suggestPlans(man, goal, goalWeight, today)) {
      const outlook = plan.customPlanOutlook(man, goal, goalWeight, suggested.calorieTarget, today);
      assert.equal(outlook.goalDate, suggested.goalDate, `${goal} ${suggested.name}`);
    }
  }
});
