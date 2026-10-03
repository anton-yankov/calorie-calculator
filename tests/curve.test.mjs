import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-module.mjs";

const { monotonePath } = loadModule("src/lib/curve.ts");

const numbers = (path) => path.match(/-?\d+(\.\d+)?/g).map(Number);

test("the curve starts and ends at the points and passes through each one", () => {
  const path = monotonePath([
    [0, 10],
    [10, 20],
    [20, 15],
  ]);
  assert.ok(path.startsWith("M0.0 10.0"));
  assert.ok(path.includes(" 10.0 20.0 C"));
  assert.ok(path.endsWith(" 20.0 15.0"));
});

test("control points never overshoot a turning point", () => {
  // A peak at y=20: no control point may go above it
  const ys = numbers(
    monotonePath([
      [0, 10],
      [10, 20],
      [20, 10],
    ]),
  ).filter((_, i) => i % 2 === 1);
  assert.ok(Math.max(...ys) <= 20);
});

test("one point or none", () => {
  assert.equal(monotonePath([]), "");
  assert.equal(monotonePath([[5, 5]]), "M5.0 5.0");
});
