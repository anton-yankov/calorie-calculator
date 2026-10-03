/**
 * An SVG path through points as a smooth curve that never overshoots: a
 * monotone cubic (Fritsch–Carlson), the same idea as d3's curveMonotoneX.
 * Between two points the curve stays within their values, so a smoothed weight
 * trend never shows a dip or bump that isn't in the data. Points must be in
 * increasing x order.
 */
export function monotonePath(points: readonly [number, number][]): string {
  if (points.length === 0) return "";
  const f = (v: number) => v.toFixed(1);
  if (points.length === 1) return `M${f(points[0]![0])} ${f(points[0]![1])}`;

  const n = points.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    dx.push(x1 - x0);
    slope.push(dx[i]! === 0 ? 0 : (y1 - y0) / dx[i]!);
  }
  // Tangents: zero at turning points, a weighted harmonic mean elsewhere
  const tangent: number[] = [slope[0]!];
  for (let i = 1; i < n - 1; i++) {
    const a = slope[i - 1]!;
    const b = slope[i]!;
    tangent.push(
      a * b <= 0
        ? 0
        : (3 * (dx[i - 1]! + dx[i]!)) /
            ((2 * dx[i]! + dx[i - 1]!) / a + (dx[i]! + 2 * dx[i - 1]!) / b),
    );
  }
  tangent.push(slope[n - 2]!);

  let path = `M${f(points[0]![0])} ${f(points[0]![1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    const h = dx[i]! / 3;
    path += ` C${f(x0 + h)} ${f(y0 + tangent[i]! * h)} ${f(x1 - h)} ${f(y1 - tangent[i + 1]! * h)} ${f(x1)} ${f(y1)}`;
  }
  return path;
}
