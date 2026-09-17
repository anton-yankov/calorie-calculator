import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-module.mjs";

/**
 * Loads an AI route with a fake OpenAI, recording claims and refunds. `reply`
 * is what the model returns (a string of output text), or an Error to throw.
 */
function route(path, reply) {
  const calls = [];
  class OpenAI {
    constructor(options) {
      calls.push(["client", options]);
      this.responses = {
        create: async () => {
          calls.push(["openai"]);
          if (reply instanceof Error) throw reply;
          return { output_text: reply };
        },
      };
    }
  }
  const loaded = loadModule(
    path,
    {
      openai: { default: OpenAI },
      "@/lib/supabase-session": { getUserId: async () => "user-1" },
      "@/lib/ai-usage": {
        OPENAI_OPTIONS: { timeout: 40_000, maxRetries: 1 },
        claimAnalysis: async () => {
          calls.push(["claim"]);
          return null;
        },
        refundAnalysis: async (id) => calls.push(["refund", id]),
      },
    },
    { process: { env: { OPENAI_API_KEY: "test" } } },
  );
  return { ...loaded, calls };
}

const labelRequest = () => {
  const form = new FormData();
  form.append("image", new File([new Uint8Array([1, 2, 3])], "label.jpg", { type: "image/jpeg" }));
  return new Request("http://test/api/products/analyze-label", { method: "POST", body: form });
};

const unreadable = JSON.stringify({
  productName: "",
  calories: null,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  basis: "unknown",
  warnings: ["Blurry"],
});

test("an unreadable label still counts: OpenAI answered and was paid", async () => {
  const r = route("src/app/api/products/analyze-label/route.ts", unreadable);
  const response = await r.POST(labelRequest());
  assert.equal(response.status, 422);
  assert.deepEqual(
    r.calls.map((c) => c[0]),
    ["claim", "client", "openai"],
  );
});

test("a request OpenAI never answered gives the analysis back", async () => {
  const r = route("src/app/api/products/analyze-label/route.ts", new Error("timed out"));
  const response = await r.POST(labelRequest());
  assert.equal(response.status, 502);
  assert.deepEqual(r.calls.at(-1), ["refund", "user-1"]);
});

test("OpenAI calls use the bounded timeout and retries", async () => {
  const r = route("src/app/api/products/analyze-label/route.ts", unreadable);
  await r.POST(labelRequest());
  assert.deepEqual(r.calls[1], ["client", { timeout: 40_000, maxRetries: 1 }]);
  assert.equal(r.maxDuration, 90);
});

test("oversized text is refused before an analysis is used", async () => {
  const r = route("src/app/api/analyze/route.ts", "{}");
  const form = new FormData();
  form.append("description", "x".repeat(2_001));
  const response = await r.POST(
    new Request("http://test/api/analyze", { method: "POST", body: form }),
  );
  assert.equal(response.status, 400);
  assert.deepEqual(r.calls, []);
});
