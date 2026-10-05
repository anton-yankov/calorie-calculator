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

/** An EAN-13-like pattern: 101 modules, bars and spaces 1–4 modules wide, guards at both ends */
const PATTERN =
  "10100010110100111001001101011101111010100011001010101101100100101100110011101001011010100010100101001";
const FRAME = { width: 640, height: 400 };
/** Height of the printed number under a real code's bars, in frame pixels */
const DIGIT_ROW = 10;

/**
 * A frame showing the pattern's bars, `module` px per module and `barHeight` px tall, turned
 * `angle` degrees (clockwise on screen) about `centre`. Rendered supersampled so the edges are
 * antialiased; `blur` 3×3 box passes, `contrast` (how dark the bars are, 0–1) and seeded
 * `noise` (± luminance) rough it up like a phone camera would. With `digits`, the data bars
 * stop short of the bottom to leave room for the number, whose glyph strokes are drawn there,
 * while the guard bars run the full height, as on a real EAN.
 */
function syntheticCode({
  angle = 0,
  module = 3,
  barHeight = 110,
  centre = { x: 320, y: 200 },
  blur = 0,
  contrast = 0.9,
  noise = 0,
  digits = false,
} = {}) {
  const { width, height } = FRAME;
  const span = PATTERN.length * module;
  const turn = (angle * Math.PI) / 180;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const SUPER = 4;
  const shade = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let sy = 0; sy < SUPER; sy++) {
        for (let sx = 0; sx < SUPER; sx++) {
          const px = x + (sx + 0.5) / SUPER - centre.x;
          const py = y + (sy + 0.5) / SUPER - centre.y;
          // Into the code's own frame: u across the bars, v along them
          const u = px * cos + py * sin;
          const v = -px * sin + py * cos;
          const m = Math.floor((u + span / 2) / module);
          const guard = m < 3 || m >= PATTERN.length - 3 || Math.abs(m - 50) <= 2;
          const bottom = digits && !guard ? barHeight / 2 - DIGIT_ROW : barHeight / 2;
          let inked = Math.abs(v) <= barHeight / 2 && v <= bottom && PATTERN[m] === "1";
          // Two thin strokes per 7-module digit cell, a pixel in from the row's top and bottom
          if (digits && v > barHeight / 2 - DIGIT_ROW + 1 && v < barHeight / 2 - 1) {
            const d = (u + span / 2) % (7 * module);
            inked ||= Math.abs(u) < span / 2 - 3 * module && (d < 1.5 || (d >= 9 && d < 10.5));
          }
          sum += inked ? 255 * (1 - contrast) : 255;
        }
      }
      shade[y * width + x] = sum / (SUPER * SUPER);
    }
  }
  for (let pass = 0; pass < blur; pass++) {
    const blurred = new Float32Array(shade);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) sum += shade[(y + dy) * width + x + dx];
        }
        blurred[y * width + x] = sum / 9;
      }
    }
    shade.set(blurred);
  }
  let seed = 12345;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < shade.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = shade[i] + (seed / 2 ** 32 - 0.5) * 2 * noise;
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = value;
    data[i * 4 + 3] = 255;
  }

  /** The ends the reader reports: the guard patterns' middles where the decoding row (or
   * column, when the code is sideways) `offset` px from the centre crosses them */
  function readLine(offset = 0) {
    const guard = span / 2 - 1.5 * module;
    return [-guard, guard].map((u) =>
      Math.abs(angle) <= 45
        ? { x: centre.x + (u - offset * sin) / cos, y: centre.y + offset }
        : { x: centre.x + offset, y: centre.y + (u - offset * cos) / sin },
    );
  }

  // The true width is between the guard middles, 1.5 modules in from each end
  return { pixels: { data, width, height }, readLine, width: span - 3 * module, barHeight, centre };
}

/** The outline of a synthetic code read `offset` px from its centre; frame and view match 1:1 */
function outlineOf(code, offset = 0) {
  return codeOutline(code.readLine(offset), FRAME, FRAME, code.pixels);
}

function near(actual, expected, tolerance, label) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label} ${actual} should be within ${tolerance} of ${expected}`,
  );
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

test("a level synthetic code measures as before: unturned, true width, bars' height", () => {
  const code = syntheticCode();
  const outline = outlineOf(code, 25);
  assert.equal(outline.angle, 0);
  assert.equal(outline.width, code.width * 1.04 + 24);
  near(outline.x, code.centre.x, 2, "centre x");
  near(outline.y, code.centre.y, 2, "centre y");
  near(outline.height, code.barHeight + 24, 4, "height");
});

test("a code leaning 6° read off its centre line turns the outline and keeps its true size", () => {
  const code = syntheticCode({ angle: 6 });
  const outline = outlineOf(code, 25);
  near(outline.angle, 6, 1, "angle");
  near(outline.x, code.centre.x, 2, "centre x");
  near(outline.y, code.centre.y, 2, "centre y");
  near(outline.height, code.barHeight + 24, 4, "height");
  // The width is the bars' own, not the longer chord the read line cut across them
  near(outline.width, code.width * 1.04 + 24, 1, "width");
  assert.ok(outline.width < (code.width / Math.cos(Math.PI / 30)) * 1.04 + 24);
});

test("a lean the other way turns the outline the other way, as CSS rotate counts it", () => {
  const outline = outlineOf(syntheticCode({ angle: -12 }), -20);
  near(outline.angle, -12, 1, "angle");
});

test("a sideways code read along a column leans by its turn past upright, sides swapped", () => {
  for (const lean of [15, -15]) {
    const code = syntheticCode({ angle: 90 + lean });
    const outline = outlineOf(code, 10);
    near(outline.angle, lean, 1, `angle at ${90 + lean}°`);
    near(outline.width, code.barHeight + 24, 4, "width");
    near(outline.height, code.width * 1.04 + 24, 1, "height");
    near(outline.x, code.centre.x, 2, "centre x");
    near(outline.y, code.centre.y, 2, "centre y");
  }
});

test("fine, blurred, noisy bars still give the lean to within a degree", () => {
  const code = syntheticCode({ angle: 5, module: 2, blur: 2, noise: 10, contrast: 0.7 });
  const outline = outlineOf(code, 15);
  near(outline.angle, 5, 1, "angle");
  near(outline.height, code.barHeight + 24, 4, "height");
});

test("a real-looking code's lean is kept even when level lines reach about as far", () => {
  // With a digit row under the bars and guards running through it, level lines slide off the
  // leaning data bars gradually while picking up digit edges, so they reach as far as lines
  // along the bars do (as seen on a real frame). That mustn't count against the lean.
  const code = syntheticCode({ angle: 8, digits: true, module: 2, blur: 1 });
  for (const offset of [20, 30]) {
    const outline = outlineOf(code, offset);
    near(outline.angle, 8, 1, `angle read ${offset} px below centre`);
    near(outline.x, code.centre.x, 2, "centre x");
    // The data bars stop short of the bottom, so their middle is half a digit row up
    near(outline.y, code.centre.y - DIGIT_ROW / 2, 2, "centre y");
  }
});

test("bars leaning too far to have been read along the line leave the outline level", () => {
  const code = syntheticCode({ angle: 40, barHeight: 260 });
  const outline = outlineOf(code, 0);
  assert.equal(outline.angle, 0);
  assert.equal(outline.width, (code.width / Math.cos((40 * Math.PI) / 180)) * 1.04 + 24);
});

test("noise that crosses the threshold often enough to look like bars doesn't turn the outline", () => {
  const code = syntheticCode({ contrast: 0, noise: 120 });
  const outline = outlineOf(code, 0);
  assert.equal(outline.angle, 0);
  for (const value of Object.values(outline)) assert.ok(Number.isFinite(value), `${value}`);
});
