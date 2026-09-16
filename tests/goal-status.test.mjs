import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-module.mjs";

const { goalStatus, statusMessage } = loadModule("src/lib/goal-status.ts");

const KCAL = 2310;
const PROTEIN = 170;
// Maintain range: 2,079–2,541 kcal (±10%)

/** Status and message together, as a bar would show them. */
const read = (goal, metric, value, isToday) => {
  const target = metric === "calories" ? KCAL : PROTEIN;
  const status = goalStatus(goal, metric, value, target, isToday);
  return [status, statusMessage(goal, metric, status, value, target)];
};

test("losing: calories are a ceiling, with a warning near it today", () => {
  assert.deepEqual(read("lose", "calories", 1500, true), ["progress", "810 kcal to go"]);
  assert.deepEqual(read("lose", "calories", 2150, true), [
    "near",
    "160 kcal left · close to your limit",
  ]);
  assert.deepEqual(read("lose", "calories", 2500, true), ["over", "Over by 190 kcal"]);
  // A finished day under the ceiling is a success, however far under
  assert.deepEqual(read("lose", "calories", 1500, false), ["met", "Under your limit by 810 kcal"]);
  assert.deepEqual(read("lose", "calories", 2700, false), ["over", "Over by 390 kcal"]);
});

test("losing: the edges of the warning and the ceiling", () => {
  assert.equal(goalStatus("lose", "calories", KCAL * 0.9 - 1, KCAL, true), "progress");
  assert.equal(goalStatus("lose", "calories", KCAL * 0.9, KCAL, true), "near");
  assert.equal(goalStatus("lose", "calories", KCAL, KCAL, true), "near"); // at the limit isn't over it
  assert.equal(goalStatus("lose", "calories", KCAL + 1, KCAL, true), "over");
  assert.deepEqual(read("lose", "calories", KCAL, false), ["met", "Right at your limit"]);
});

test("maintaining: calories should land in the ±10% range", () => {
  assert.deepEqual(read("maintain", "calories", 1500, true), [
    "progress",
    "579 kcal to your range",
  ]);
  assert.deepEqual(read("maintain", "calories", 2300, true), ["met", "Within your range"]);
  assert.deepEqual(read("maintain", "calories", 1900, false), [
    "short",
    "Below your range by 179 kcal",
  ]);
  assert.deepEqual(read("maintain", "calories", 2600, false), [
    "over",
    "Above your range by 59 kcal",
  ]);
  // Both range edges count as on track
  assert.equal(goalStatus("maintain", "calories", KCAL * 0.9, KCAL, false), "met");
  assert.equal(goalStatus("maintain", "calories", KCAL * 1.1, KCAL, false), "met");
});

test("gaining: calories are a floor with no penalty above", () => {
  assert.deepEqual(read("gain", "calories", 1500, true), ["progress", "810 kcal to go"]);
  assert.deepEqual(read("gain", "calories", 2000, false), ["short", "Short by 310 kcal"]);
  assert.deepEqual(read("gain", "calories", KCAL, false), ["met", "Reached"]);
  assert.deepEqual(read("gain", "calories", 4000, false), ["met", "Reached"]);
});

test("protein is a floor for every goal", () => {
  for (const goal of ["lose", "maintain", "gain"]) {
    assert.deepEqual(read(goal, "protein", 120, true), ["progress", "50 g to go"], goal);
    assert.deepEqual(read(goal, "protein", 150, false), ["short", "Short by 20 g"], goal);
    assert.deepEqual(read(goal, "protein", 170, false), ["met", "Reached"], goal);
    assert.deepEqual(read(goal, "protein", 250, true), ["met", "Reached"], goal);
  }
});

test("only a finished day can fall short", () => {
  for (const goal of ["lose", "maintain", "gain"]) {
    for (const metric of ["calories", "protein"]) {
      const target = metric === "calories" ? KCAL : PROTEIN;
      assert.notEqual(goalStatus(goal, metric, 0, target, true), "short", `${goal} ${metric}`);
    }
  }
});

test("whole-number intakes on the range edges are never misjudged by rounding", () => {
  // 2310 × 1.1 isn't exactly 2541 in floating point; the real intake 2541 must still count
  for (let target = 1200; target <= 5000; target++) {
    const low = Math.ceil(target * 0.9 - 1e-9);
    const high = Math.floor(target * 1.1 + 1e-9);
    assert.equal(goalStatus("maintain", "calories", low, target, false), "met", `${low}/${target}`);
    assert.equal(
      goalStatus("maintain", "calories", high, target, false),
      "met",
      `${high}/${target}`,
    );
    assert.equal(goalStatus("lose", "calories", low, target, true), "near", `${low}/${target}`);
  }
});

test("water is a floor for every goal, shown in ml or litres", () => {
  for (const goal of ["lose", "maintain", "gain"]) {
    const status = goalStatus(goal, "water", 1200, 2500, true);
    assert.equal(status, "progress", goal);
    assert.equal(statusMessage(goal, "water", status, 1200, 2500), "1.3 L to go", goal);
    assert.equal(goalStatus(goal, "water", 2500, 2500, false), "met", goal);
    const short = goalStatus(goal, "water", 2000, 2500, false);
    assert.equal(statusMessage(goal, "water", short, 2000, 2500), "Short by 500 ml", goal);
  }
});

test("each status maps to one colour: the goal's tint only while in progress", () => {
  const { statusColor } = loadModule("src/components/goal-colors.ts");
  assert.equal(statusColor("lose", "progress"), "var(--tint-lose)");
  assert.equal(statusColor("maintain", "progress"), "var(--tint-maintain)");
  assert.equal(statusColor("gain", "progress"), "var(--tint-gain)");
  for (const goal of ["lose", "maintain", "gain"]) {
    assert.equal(statusColor(goal, "met"), "var(--green)");
    assert.equal(statusColor(goal, "near"), "var(--amber)");
    assert.equal(statusColor(goal, "short"), "var(--amber)");
    assert.equal(statusColor(goal, "over"), "var(--danger)");
  }
});
