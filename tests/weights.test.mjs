import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-module.mjs";

const { submittedPastDay, validWeighIn } = loadModule("src/lib/profile-input.ts");

const key = (date) => date.toISOString().slice(0, 10);
const daysFromNow = (n) => key(new Date(Date.now() + n * 86_400_000));

/** Loads the Stats actions with fake storage, recording what they would do. */
function weightActions({ userId = "user-1" } = {}) {
  const calls = [];
  const loaded = loadModule("src/app/(app)/stats/actions.ts", {
    "next/cache": { revalidatePath: (path) => calls.push(["revalidate", path]) },
    "@/lib/supabase-session": { getUserId: async () => userId },
    "@/lib/weights": {
      saveWeight: async (id, entry) => calls.push(["save", id, entry]),
      deleteWeight: async (id, day) => calls.push(["delete", id, day]),
    },
  });
  return { ...loaded, calls };
}

test("a weigh-in day must be a real date that isn't in the future", () => {
  assert.equal(submittedPastDay("2025-03-14"), "2025-03-14");
  assert.equal(submittedPastDay(daysFromNow(0)), daysFromNow(0));
  // A timezone ahead of the server may already be on tomorrow
  assert.equal(submittedPastDay(daysFromNow(1)), daysFromNow(1));
  assert.equal(submittedPastDay(daysFromNow(3)), null);
  assert.equal(submittedPastDay("2026-02-31"), null); // would roll over to March
  assert.equal(submittedPastDay("14.03.2025"), null);
  assert.equal(submittedPastDay(20250314), null);
});

test("weigh-ins stay within 30–300 kg and are rounded to 0.1", () => {
  assert.equal(validWeighIn(83.44), 83.4);
  assert.equal(validWeighIn(70), 70);
  assert.match(validWeighIn(29.9), /between 30 and 300/);
  assert.match(validWeighIn("80"), /between 30 and 300/);
  assert.match(validWeighIn(Number.NaN), /between 30 and 300/);
});

test("saving a weigh-in stores it and refreshes Stats and Settings", async () => {
  const action = weightActions();
  assert.deepEqual(await action.saveWeightAction({ day: "2026-09-10", weightKg: 83.44 }), {});
  assert.deepEqual(action.calls, [
    ["save", "user-1", { day: "2026-09-10", weightKg: 83.4 }],
    ["revalidate", "/stats"],
    ["revalidate", "/settings"],
  ]);
});

test("bad weigh-ins and logged-out requests save nothing", async () => {
  const action = weightActions();
  assert.match(
    (await action.saveWeightAction({ day: daysFromNow(5), weightKg: 80 })).error,
    /future/,
  );
  assert.match((await action.saveWeightAction({ day: "2026-09-10", weightKg: 500 })).error, /300/);
  assert.deepEqual(await action.deleteWeightAction("yesterday"), { error: "Invalid day" });

  const loggedOut = weightActions({ userId: null });
  const denied = { error: "Authentication required" };
  assert.deepEqual(await loggedOut.saveWeightAction({ day: "2026-09-10", weightKg: 80 }), denied);
  assert.deepEqual(await loggedOut.deleteWeightAction("2026-09-10"), denied);
  assert.deepEqual([...action.calls, ...loggedOut.calls], []);
});

test("deleting a weigh-in removes that day for this user only", async () => {
  const action = weightActions();
  assert.deepEqual(await action.deleteWeightAction("2026-09-10"), {});
  assert.deepEqual(action.calls[0], ["delete", "user-1", "2026-09-10"]);
});

test("days between two day keys ignore clock changes", () => {
  const { daysBetween } = loadModule("src/lib/day.ts");
  assert.equal(daysBetween("2026-09-09", "2026-09-16"), 7);
  assert.equal(daysBetween("2026-09-16", "2026-09-16"), 0);
  assert.equal(daysBetween("2026-09-16", "2026-09-09"), -7);
  // Summer time starts on 29 March in Europe: that day is 23 hours long
  assert.equal(daysBetween("2026-03-28", "2026-03-30"), 2);
});
