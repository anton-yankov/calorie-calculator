import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-module.mjs";

const stats = loadModule("src/lib/stats.ts");

const plan = (effectiveFrom, goal, calorieTarget) => ({
  effectiveFrom,
  goal,
  kgPerWeek: goal === "maintain" ? null : 0.5,
  goalWeightKg: goal === "maintain" ? null : 78,
  calorieTarget,
  proteinTarget: 150,
  maintenanceKcal: 2500,
  weightKg: 85,
});

const day = (key, calories, protein_g = 100) => ({
  loggedAt: `${key}T12:00:00`,
  totals: { calories, protein_g, carbs_g: 0, fat_g: 0 },
});

const summary = (plans, rows, today) =>
  stats.computeRange(stats.groupByDay(rows), "7d", plans, null, today).summary;

test("losing: a finished day is on track at or under the limit", () => {
  const plans = [plan("2026-01-01", "lose", 2000)];
  const rows = [day("2026-09-10", 1500), day("2026-09-11", 2000), day("2026-09-12", 2100)];
  assert.equal(summary(plans, rows, "2026-09-13").onTrackDays, 2);
});

test("maintaining: on track only within ±10% of the target", () => {
  const plans = [plan("2026-01-01", "maintain", 2000)];
  const rows = [
    day("2026-09-09", 1790), // below the range
    day("2026-09-10", 1800),
    day("2026-09-11", 2200),
    day("2026-09-12", 2210), // above the range
  ];
  assert.equal(summary(plans, rows, "2026-09-13").onTrackDays, 2);
});

test("gaining: on track at or over the target", () => {
  const plans = [plan("2026-01-01", "gain", 3000)];
  const rows = [day("2026-09-11", 2900), day("2026-09-12", 3400)];
  assert.equal(summary(plans, rows, "2026-09-13").onTrackDays, 1);
});

test("each day is judged by its own plan, and today isn't counted yet", () => {
  // Lose until the 11th, then gain from the 12th
  const plans = [plan("2026-01-01", "lose", 2000), plan("2026-09-12", "gain", 3000)];
  const rows = [
    day("2026-09-10", 1900), // under the old limit: on track
    day("2026-09-12", 2500), // under the new target: not on track
    day("2026-09-13", 3200), // today: still in progress
  ];
  const result = summary(plans, rows, "2026-09-13");
  assert.equal(result.completeDays, 2);
  assert.equal(result.onTrackDays, 1);
});

test("protein counts days at the target or more", () => {
  const plans = [plan("2026-01-01", "lose", 2000)];
  const rows = [day("2026-09-11", 1800, 149), day("2026-09-12", 1800, 150)];
  assert.equal(summary(plans, rows, "2026-09-13").proteinDays, 1);
});

test("average carbs and fat cover finished days only", () => {
  const plans = [plan("2026-01-01", "lose", 2000)];
  const rows = [
    {
      loggedAt: "2026-09-11T12:00:00",
      totals: { calories: 0, protein_g: 0, carbs_g: 100, fat_g: 40 },
    },
    {
      loggedAt: "2026-09-12T12:00:00",
      totals: { calories: 0, protein_g: 0, carbs_g: 200, fat_g: 60 },
    },
    {
      loggedAt: "2026-09-13T12:00:00",
      totals: { calories: 0, protein_g: 0, carbs_g: 900, fat_g: 900 },
    },
  ];
  const result = summary(plans, rows, "2026-09-13");
  assert.equal(result.avgCarbs, 150);
  assert.equal(result.avgFat, 50);
});

test("the macro split weighs fat at 9 kcal per gram", () => {
  // 100 g protein = 400 kcal, 100 g carbs = 400 kcal, 100/9 g fat ≈ 100 kcal
  const split = stats.macroSplit({ protein: 100, carbs: 100, fat: 100 / 9 });
  assert.ok(Math.abs(split.protein - 400 / 900) < 1e-9);
  assert.ok(Math.abs(split.carbs - 400 / 900) < 1e-9);
  assert.ok(Math.abs(split.fat - 100 / 900) < 1e-9);
  assert.equal(stats.macroSplit({ protein: 0, carbs: 0, fat: 0 }), null);
});
