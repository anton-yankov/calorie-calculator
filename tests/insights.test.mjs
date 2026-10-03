import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-module.mjs";

const { pickInsight } = loadModule("src/lib/insights.ts");
const { groupByDay } = loadModule("src/lib/stats.ts");

const plans = [
  {
    effectiveFrom: "2026-01-01",
    goal: "lose",
    kgPerWeek: 0.5,
    goalWeightKg: 78,
    calorieTarget: 2000,
    proteinTarget: 120,
    proteinPerKg: 1.6,
    maintenanceKcal: 2550,
    weightKg: 85,
  },
];
const row = (day, calories, protein_g = 120) => ({
  loggedAt: `${day}T12:00:00`,
  totals: { calories, protein_g, carbs_g: 0, fat_g: 0 },
});
const pick = (rows, extra = {}) =>
  pickInsight({
    days: groupByDay(rows),
    plans,
    start: "2026-09-04",
    today: "2026-10-03",
    onTrackNow: 0,
    onTrackBefore: null,
    rangeDays: 30,
    ...extra,
  });

// Fridays and Saturdays in September 2026: 4–5, 11–12, 18–19, 25–26
const everyDay = (calories, protein) => {
  const rows = [];
  for (let d = 4; d <= 30; d++)
    rows.push(row(`2026-09-${String(d).padStart(2, "0")}`, calories, protein));
  rows.push(row("2026-10-01", calories, protein), row("2026-10-02", calories, protein));
  return rows;
};

test("weekday pattern: most days over the limit on the same two weekdays", () => {
  const rows = everyDay(1800, 100).map((r) =>
    [
      "2026-09-04",
      "2026-09-05",
      "2026-09-11",
      "2026-09-19",
      "2026-09-25",
      "2026-09-26",
      "2026-09-15",
    ].includes(r.loggedAt.slice(0, 10))
      ? row(r.loggedAt.slice(0, 10), 2500, 100)
      : r,
  );
  assert.deepEqual(pick(rows), {
    title: "Weekends are where it slips",
    body: "6 of your 7 days over the limit were a Friday or Saturday.",
  });
});

test("protein streak: five finished days in a row at the target", () => {
  const rows = everyDay(1800, 100).map((r) =>
    r.loggedAt >= "2026-09-27" ? row(r.loggedAt.slice(0, 10), 1800, 130) : r,
  );
  assert.equal(pick(rows).body, "6 days in a row at your protein target.");
});

test("protein gap: usually 15 g or more under the target", () => {
  assert.match(pick(everyDay(1800, 95)).body, /^You're usually about 25 g short on protein/);
});

test("getting better: three or more days on track than the period before", () => {
  assert.equal(
    pick(everyDay(1800, 110), { onTrackNow: 20, onTrackBefore: 15 }).body,
    "20 days on track, up from 15 the 30 days before.",
  );
});

test("logging gaps: three of the last seven days missing", () => {
  const rows = everyDay(1800, 110).filter(
    (r) => !["2026-09-28", "2026-09-30", "2026-10-02"].includes(r.loggedAt.slice(0, 10)),
  );
  assert.match(pick(rows).body, /^3 of the last 7 days weren't logged/);
});

test("nothing worth saying: no card", () => {
  assert.equal(pick(everyDay(1800, 110)), null); // 10 g under: not enough to mention
});
