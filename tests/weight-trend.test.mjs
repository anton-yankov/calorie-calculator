import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-module.mjs";

const { withTrend, trendOverRange } = loadModule("src/lib/weight-trend.ts");

const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

const entries = [
  { day: "2026-09-01", weightKg: 84 },
  { day: "2026-09-02", weightKg: 84.6 },
  { day: "2026-09-05", weightKg: 83.2 }, // two days skipped
  { day: "2026-09-10", weightKg: 83 },
];

test("the trend starts at the first weigh-in and moves 10% toward each next one", () => {
  const points = withTrend(entries);
  close(points[0].trendKg, 84);
  close(points[1].trendKg, 84.06); // 84 + 0.1 × 0.6
  close(points[2].trendKg, 83.974); // 84.06 + 0.1 × (83.2 − 84.06)
  close(points[3].trendKg, 83.8766);
  // Skipped days add no points; the weigh-ins themselves are untouched
  assert.deepEqual(
    points.map((p) => [p.day, p.weightKg]),
    entries.map((e) => [e.day, e.weightKg]),
  );
  assert.deepEqual(withTrend([]), []);
});

test("one heavy morning barely moves the trend", () => {
  const steady = Array.from({ length: 10 }, (_, i) => ({
    day: `2026-09-${String(i + 1).padStart(2, "0")}`,
    weightKg: 80,
  }));
  const spike = withTrend([...steady, { day: "2026-09-11", weightKg: 82 }]);
  close(spike.at(-1).trendKg, 80.2);
});

test("the range change measures from the trend in effect on its first day", () => {
  const points = withTrend(entries);
  // The range starts on the 3rd: the 2nd's trend is the one in effect
  const range = trendOverRange(points, "2026-09-03", "2026-09-10");
  assert.deepEqual(
    range.points.map((p) => p.day),
    ["2026-09-05", "2026-09-10"],
  );
  close(range.change, 83.8766 - 84.06);
});

test("a range with its first weigh-in inside it measures from that weigh-in", () => {
  const points = withTrend(entries);
  close(trendOverRange(points, "2026-08-01", "2026-09-02").change, 0.06);
});

test("no change without two trend values", () => {
  const points = withTrend(entries);
  assert.equal(trendOverRange(points, "2026-09-01", "2026-09-01").change, null);
  assert.equal(trendOverRange(points, "2026-10-01", "2026-10-07").change, null);
  // Nothing inside the range, even with an earlier trend
  const later = trendOverRange(points, "2026-09-11", "2026-09-20");
  assert.deepEqual(later, { points: [], change: null });
  assert.deepEqual(trendOverRange([], "2026-09-01", "2026-09-30"), { points: [], change: null });
});
