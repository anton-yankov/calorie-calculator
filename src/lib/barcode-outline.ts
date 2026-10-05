/**
 * Where a just-read barcode sits on screen, so the scanner can draw its
 * outline around it.
 *
 * The reader only reports the two ends of the line it read across the bars,
 * in camera-frame pixels, and that line can cross the bars anywhere between
 * their top and bottom. The bars' real extent is measured from the frame
 * itself: lines parallel to the read one keep crossing the bars until they
 * run off the code. The read line always runs straight across the frame even
 * when the code leans, so the lean is measured from the bar edges around it
 * and the box turned to match. The result is then mapped onto the screen,
 * where the preview fills the view like object-fit: cover (scaled up, edges
 * cropped).
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** The shape of ImageData, so tests can hand in plain arrays */
export interface Pixels extends Size {
  data: Uint8ClampedArray;
}

/** A box in view pixels: centre, size, and its turn in degrees (never more than 45° either way) */
export interface CodeOutline {
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
}

/** Room between the bars and the outline, in view pixels */
const PADDING = 12;
/** Bars' height per unit of read-line length when it can't be measured: a typical retail code */
const DEFAULT_HEIGHT = 0.6;
/** Parallel lines still on the bars cross at least this share of the read line's edges */
const ON_BARS = 0.6;
/** Distance between the parallel lines tried, in frame pixels */
const STEP = 2;
/** How far either side of the read line the bars' tilt is measured, in frame pixels */
const TILT_BAND = 4;
/** The bar edges must agree on one direction at least this well for their tilt to count */
const COHERENCE = 0.6;
/** Bars tilted further than this from the read line couldn't have been decoded along it */
const MAX_TILT = 30;
/** The bars measured along a misread lean come out at least this much shorter than level */
const LEAN_REACH = 0.8;

/** How a frame is scaled and offset to cover the view, centred */
export function coverPlacement(frame: Size, view: Size) {
  const scale = Math.max(view.width / frame.width, view.height / frame.height);
  return {
    scale,
    left: (view.width - frame.width * scale) / 2,
    top: (view.height - frame.height * scale) / 2,
  };
}

function luminanceAt(pixels: Pixels, x: number, y: number): number | null {
  const column = Math.round(x);
  const row = Math.round(y);
  if (column < 0 || row < 0 || column >= pixels.width || row >= pixels.height) return null;
  const index = (row * pixels.width + column) * 4;
  return (
    (pixels.data[index] ?? 0) * 0.299 +
    (pixels.data[index + 1] ?? 0) * 0.587 +
    (pixels.data[index + 2] ?? 0) * 0.114
  );
}

/** Samples along the line from a to b, moved sideways by `shift`; null once it leaves the frame */
function samplesAlong(pixels: Pixels, a: Point, b: Point, shift: Point): number[] | null {
  const count = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y)));
  const samples: number[] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const value = luminanceAt(
      pixels,
      a.x + (b.x - a.x) * t + shift.x,
      a.y + (b.y - a.y) * t + shift.y,
    );
    if (value === null) return null;
    samples.push(value);
  }
  return samples;
}

/** How many times the samples switch between darker and lighter than the threshold */
function edges(samples: number[], threshold: number): number {
  let count = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i - 1]! < threshold !== samples[i]! < threshold) count++;
  }
  return count;
}

/** Scharr luminance gradient at (x, y); null when a neighbour is off the frame */
function gradientAt(pixels: Pixels, x: number, y: number): Point | null {
  const at = (dx: number, dy: number) => luminanceAt(pixels, x + dx, y + dy) ?? NaN;
  const gradient = {
    x: 3 * (at(1, -1) - at(-1, -1)) + 10 * (at(1, 0) - at(-1, 0)) + 3 * (at(1, 1) - at(-1, 1)),
    y: 3 * (at(-1, 1) - at(-1, -1)) + 10 * (at(0, 1) - at(0, -1)) + 3 * (at(1, 1) - at(1, -1)),
  };
  return Number.isNaN(gradient.x + gradient.y) ? null : gradient;
}

/**
 * How far the bars lean from the read line a→b, in degrees, from the gradients in a band
 * around it (they point across the bars, so their shared direction is the code's true
 * across-direction). Zero when they don't agree well enough to trust.
 */
function tilt(pixels: Pixels, a: Point, b: Point, normal: Point): number {
  let xx = 0;
  let yy = 0;
  let xy = 0;
  const count = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y)));
  for (let i = 0; i <= count; i++) {
    for (let k = -TILT_BAND; k <= TILT_BAND; k++) {
      const t = i / count;
      const g = gradientAt(
        pixels,
        a.x + (b.x - a.x) * t + normal.x * k,
        a.y + (b.y - a.y) * t + normal.y * k,
      );
      if (!g) continue;
      xx += g.x * g.x;
      yy += g.y * g.y;
      xy += g.x * g.y;
    }
  }
  if (!(xx + yy)) return 0;
  const coherence = Math.hypot(xx - yy, 2 * xy) / (xx + yy);
  const across = Math.atan2(2 * xy, xx - yy) / 2;
  let lean = ((across - Math.atan2(b.y - a.y, b.x - a.x)) * 180) / Math.PI;
  lean -= 180 * Math.round(lean / 180);
  return coherence < COHERENCE || Math.abs(lean) > MAX_TILT || Math.abs(lean) < 1 ? 0 : lean;
}

/** The read line a→b turned by `lean` degrees about its middle, cut to its span across the bars */
function turnedLine(a: Point, b: Point, lean: number) {
  const angle = Math.atan2(b.y - a.y, b.x - a.x) + (lean * Math.PI) / 180;
  const direction = { x: Math.cos(angle), y: Math.sin(angle) };
  const length = Math.abs((b.x - a.x) * direction.x + (b.y - a.y) * direction.y);
  const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return {
    direction,
    normal: { x: -direction.y, y: direction.x },
    length,
    a: { x: middle.x - (direction.x * length) / 2, y: middle.y - (direction.y * length) / 2 },
    b: { x: middle.x + (direction.x * length) / 2, y: middle.y + (direction.y * length) / 2 },
  };
}

/** How far the bars reach from the read line towards `normal`, in frame pixels */
function reach(
  pixels: Pixels,
  a: Point,
  b: Point,
  normal: Point,
  threshold: number,
  baseline: number,
  limit: number,
): number {
  let distance = 0;
  for (let step = STEP; step <= limit; step += STEP) {
    const samples = samplesAlong(pixels, a, b, { x: normal.x * step, y: normal.y * step });
    if (!samples || edges(samples, threshold) < baseline * ON_BARS) break;
    distance = step;
  }
  return distance;
}

/** How far the bars reach either side of the read line a→b; null when it crosses too few edges */
function extent(pixels: Pixels, a: Point, b: Point, normal: Point, limit: number) {
  const readLine = samplesAlong(pixels, a, b, { x: 0, y: 0 });
  if (!readLine) return null;
  const threshold = (Math.min(...readLine) + Math.max(...readLine)) / 2;
  const baseline = edges(readLine, threshold);
  // A real read crosses dozens of bar edges; too few means the frame can't be trusted
  if (baseline < 10) return null;
  return {
    towards: reach(pixels, a, b, normal, threshold, baseline, limit),
    away: reach(pixels, a, b, { x: -normal.x, y: -normal.y }, threshold, baseline, limit),
  };
}

/**
 * The outline for a code read between `ends` (frame pixels) in a `frame`-sized
 * camera frame, shown cover-fitted in a `view`-sized preview. With `pixels`
 * (the frame that was read) the bars' height is measured, otherwise it takes a
 * typical code's proportions. Null when there's no usable line or the code's
 * centre is cropped off screen.
 */
export function codeOutline(
  ends: Point[],
  frame: Size,
  view: Size,
  pixels?: Pixels | null,
): CodeOutline | null {
  const a = ends[0];
  const b = ends[ends.length - 1];
  if (!a || !b || ends.length < 2 || !frame.width || !frame.height) return null;
  let length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 8) return null;

  let direction = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  let normal = { x: -direction.y, y: direction.x };
  let towards = length * (DEFAULT_HEIGHT / 2);
  let away = towards;
  const level = pixels ? extent(pixels, a, b, normal, length) : null;
  if (pixels && level) {
    ({ towards, away } = level);
    // The read line only ever runs straight across the frame, so a leaning code is measured
    // along its own bars instead, where the parallel lines stay on them to their real ends
    const lean = tilt(pixels, a, b, normal);
    const turned = lean ? turnedLine(a, b, lean) : null;
    const leaning = turned && extent(pixels, turned.a, turned.b, turned.normal, turned.length);
    // Level lines slide off a leaning code's bars gradually, and the digits under them keep
    // adding edges, so level and leaning measurements come out within a few pixels of each
    // other either way. Only a lean that falls well short of level is clearly wrong.
    if (turned && leaning && leaning.towards + leaning.away >= (towards + away) * LEAN_REACH) {
      ({ towards, away } = leaning);
      ({ direction, normal, length } = turned);
    }
  }

  // The bars reach unevenly either side of the read line; their middle is half the difference over
  const shift = (towards - away) / 2;
  const { scale, left, top } = coverPlacement(frame, view);
  const x = ((a.x + b.x) / 2 + normal.x * shift) * scale + left;
  const y = ((a.y + b.y) / 2 + normal.y * shift) * scale + top;
  if (x < 0 || y < 0 || x > view.width || y > view.height) return null;

  // The ends are the middles of the guard bars, so the bars reach a little past them
  const across = length * 1.04 * scale + PADDING * 2;
  const along = (towards + away) * scale + PADDING * 2;
  // Turn the box as little as possible: a code read right to left is the same box half a
  // turn round, and a sideways one is an upright box with its sides swapped. The scanner's
  // square frame flies onto this box, so a quarter turn would show as the frame spinning.
  let angle = (Math.atan2(direction.y, direction.x) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle <= -90) angle += 180;
  const sideways = Math.abs(angle) > 45;
  if (sideways) angle -= Math.sign(angle) * 90;

  return {
    x,
    y,
    width: sideways ? along : across,
    height: sideways ? across : along,
    angle,
  };
}
