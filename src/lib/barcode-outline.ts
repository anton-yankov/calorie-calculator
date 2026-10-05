/**
 * Where a just-read barcode sits on screen, so the scanner can draw its
 * outline around it.
 *
 * The reader only reports the two ends of the line it read across the bars,
 * in camera-frame pixels, and that line can cross the bars anywhere between
 * their top and bottom. The bars' real extent is measured from the frame
 * itself: lines parallel to the read one keep crossing the bars until they
 * run off the code. The result is then mapped onto the screen, where the
 * preview fills the view like object-fit: cover (scaled up, edges cropped).
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
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 8) return null;

  const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
  let towards = length * (DEFAULT_HEIGHT / 2);
  let away = towards;
  const readLine = pixels ? samplesAlong(pixels, a, b, { x: 0, y: 0 }) : null;
  if (pixels && readLine) {
    const threshold = (Math.min(...readLine) + Math.max(...readLine)) / 2;
    const baseline = edges(readLine, threshold);
    // A real read crosses dozens of bar edges; too few means the frame can't be trusted
    if (baseline >= 10) {
      towards = reach(pixels, a, b, normal, threshold, baseline, length);
      away = reach(pixels, a, b, { x: -normal.x, y: -normal.y }, threshold, baseline, length);
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
  let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
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
