import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-module.mjs";

const friendId = "5b0c7a52-6f0e-4d7c-9a51-2f7d3c1e8a90";

/** Loads the admin action with a chosen viewer, recording saved caps. */
function adminActions(viewer) {
  const calls = [];
  const loaded = loadModule("src/app/(app)/admin/actions.ts", {
    "next/cache": { revalidatePath: (path, type) => calls.push(["revalidate", path, type]) },
    "@/lib/supabase-session": { getViewer: async () => viewer },
    "@/lib/admin": { setDailyCap: async (id, cap) => calls.push(["cap", id, cap]) },
  });
  return { ...loaded, calls };
}

test("only the admin can change a cap", async () => {
  for (const viewer of [null, { userId: friendId, isAdmin: false }]) {
    const action = adminActions(viewer);
    assert.deepEqual(await action.setDailyCapAction(friendId, 1000), { error: "Not allowed" });
    assert.deepEqual(action.calls, []);
  }
});

test("caps are whole numbers from 0 to 1000 for a real user id", async () => {
  const action = adminActions({ userId: "admin", isAdmin: true });
  for (const cap of [-1, 1001, 2.5, "30", Number.NaN]) {
    assert.match((await action.setDailyCapAction(friendId, cap)).error, /0 to 1000/);
  }
  assert.deepEqual(await action.setDailyCapAction("not-a-user", 30), { error: "Invalid user" });
  assert.deepEqual(action.calls, []);
});

test("a valid cap is saved and the admin pages refresh", async () => {
  const action = adminActions({ userId: "admin", isAdmin: true });
  assert.deepEqual(await action.setDailyCapAction(friendId, 0), {});
  assert.deepEqual(action.calls, [
    ["cap", friendId, 0], // 0 pauses AI for that user
    ["revalidate", "/admin", "layout"],
  ]);
});
