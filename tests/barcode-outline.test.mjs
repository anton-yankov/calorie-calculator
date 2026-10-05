import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "./helpers/load-module.mjs";

const { codeOutline, coverPlacement } = loadModule("src/lib/barcode-outline.ts");

/** A white frame with 4px black/white bars between x 100–300, rows `top` to `bottom` */
function framePixels(width, height, top, bottom) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = top; y < bottom; y++) {
    for (let x = 100; x < 300; x++) {
      if (Math.floor((x - 100) / 4) % 2 === 0) {
        const index = (y * width + x) * 4;
        data[index] = data[index + 1] = data[index + 2] = 0;
      }
    }
  }
  return { data, width, height };
}

test("cover placement scales a landscape frame up to fill a portrait view, centred", () => {
  const { scale, left, top } = coverPlacement(
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  );
  assert.equal(scale, 844 / 720);
  assert.equal(top, 0);
  // The frame's centre lands on the view's centre
  assert.ok(Math.abs(640 * scale + left - 195) < 1e-9);
});

test("without pixels the outline centres on the read line with typical proportions", () => {
  const outline = codeOutline(
    [
      { x: 100, y: 200 },
      { x: 300, y: 200 },
    ],
    { width: 400, height: 300 },
    { width: 400, height: 300 },
  );
  assert.equal(outline.x, 200);
  assert.equal(outline.y, 200);
  assert.equal(outline.angle, 0);
  assert.equal(outline.width, 200 * 1.04 + 24);
  assert.equal(outline.height, 200 * 0.6 + 24);
});

test("the bars' height is measured, so a read near their top still centres the outline", () => {
  const pixels = framePixels(400, 300, 150, 210);
  const outline = codeOutline(
    [
      { x: 102, y: 156 },
      { x: 298, y: 156 },
    ],
    { width: 400, height: 300 },
    { width: 400, height: 300 },
    pixels,
  );
  // Bars run from row 150 to 209: centre ≈ 180, height ≈ 60 plus padding
  assert.ok(Math.abs(outline.y - 180) <= 2, `centre ${outline.y}`);
  assert.ok(Math.abs(outline.height - 24 - 60) <= 4, `height ${outline.height}`);
});

test("a sideways code gives a tall, unturned outline, so the frame never spins onto it", () => {
  const view = { width: 400, height: 400 };
  const frame = { width: 400, height: 400 };
  const down = codeOutline(
    [
      { x: 200, y: 100 },
      { x: 200, y: 300 },
    ],
    frame,
    view,
  );
  const up = codeOutline(
    [
      { x: 200, y: 300 },
      { x: 200, y: 100 },
    ],
    frame,
    view,
  );
  for (const outline of [down, up]) {
    assert.equal(outline.angle, 0);
    assert.equal(outline.width, 200 * 0.6 + 24);
    assert.equal(outline.height, 200 * 1.04 + 24);
  }
});

test("a code read right to left isn't drawn upside down", () => {
  const outline = codeOutline(
    [
      { x: 300, y: 200 },
      { x: 100, y: 200 },
    ],
    { width: 400, height: 300 },
    { width: 400, height: 300 },
  );
  assert.equal(outline.angle, 0);
});

test("no outline when the code's centre is cropped off screen or there's no line", () => {
  const frame = { width: 1280, height: 720 };
  const view = { width: 390, height: 844 };
  // x 100 in the frame is far left of the cropped, portrait preview
  assert.equal(
    codeOutline(
      [
        { x: 60, y: 360 },
        { x: 140, y: 360 },
      ],
      frame,
      view,
    ),
    null,
  );
  assert.equal(codeOutline([{ x: 600, y: 360 }], frame, view), null);
  assert.equal(codeOutline([], frame, view), null);
});
