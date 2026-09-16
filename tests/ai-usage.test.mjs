import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-module.mjs";

/** A fake Supabase query: every filter returns itself, the row comes back at the end. */
const query = (data, error = null) => {
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => ({ data, error }),
  };
  return q;
};

function usage({ used = null, cap = null, claim = null, claimError = null } = {}) {
  const calls = [];
  const loaded = loadModule("src/lib/ai-usage.ts", {
    "@/lib/supabase-session": {
      createSessionClient: async () => ({
        from: (table) =>
          table === "ai_usage"
            ? query(used === null ? null : { used })
            : query(cap === null ? null : { daily_cap: cap }),
        rpc: async (name) => {
          calls.push(["rpc", name]);
          return { data: claim, error: claimError };
        },
      }),
    },
    "@/lib/supabase-admin": {
      createAdminClient: () => ({
        rpc: async (name, args) => {
          calls.push(["admin rpc", name, args]);
          return { error: null };
        },
      }),
    },
  });
  return { ...loaded, calls };
}

const friend = { userId: "user-2", isAdmin: false };
const admin = { userId: "user-1", isAdmin: true };

test("the AI day follows Sofia's calendar, not the server's", () => {
  const { sofiaDay } = usage();
  // 21:30 UTC is already past midnight in Sofia (UTC+3 in summer)
  assert.equal(sofiaDay(new Date("2026-09-16T21:30:00Z")), "2026-09-17");
  assert.equal(sofiaDay(new Date("2026-09-16T20:30:00Z")), "2026-09-16");
  // UTC+2 in winter
  assert.equal(sofiaDay(new Date("2026-01-10T22:30:00Z")), "2026-01-11");
});

test("the allowance uses the default cap, a user's own cap, or none for the admin", async () => {
  assert.deepEqual(await usage().getAiAllowance(friend), { used: 0, cap: 20 });
  assert.deepEqual(await usage({ used: 7, cap: 40 }).getAiAllowance(friend), {
    used: 7,
    cap: 40,
  });
  assert.deepEqual(await usage({ used: 31, cap: 5 }).getAiAllowance(admin), {
    used: 31,
    cap: null,
  });
});

test("a claim within the cap lets the request through", async () => {
  const { claimAnalysis, calls } = usage({ claim: { allowed: true, used: 3, cap: 20 } });
  assert.equal(await claimAnalysis(), null);
  assert.deepEqual(calls, [["rpc", "claim_ai_analysis"]]);
});

test("a claim over the cap is refused with a 429 and the reason", async () => {
  const refused = await usage({ claim: { allowed: false, used: 20, cap: 20 } }).claimAnalysis();
  assert.equal(refused.status, 429);
  assert.deepEqual(await refused.json(), {
    error: "You've used today's 20 analyses. They're back at midnight.",
  });
});

test("a count that can't be checked refuses the request", async () => {
  const refused = await usage({ claimError: { message: "function missing" } }).claimAnalysis();
  assert.equal(refused.status, 503);
});

test("refunds go through the secret-key client for that user", async () => {
  const { refundAnalysis, calls } = usage();
  await refundAnalysis("user-2");
  assert.deepEqual(calls, [["admin rpc", "refund_ai_analysis", { p_user: "user-2" }]]);
});
