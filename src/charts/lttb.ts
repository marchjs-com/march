// Largest-Triangle-Three-Buckets downsampling (Steinarsson, 2013): keeps the visual shape of a series with far fewer points.
// Returns a subset of the input items (same references), always including the first and the last item.

const coord = (p: unknown, i: 0 | 1, k: "x" | "y"): number =>
  (Array.isArray(p) ? (p as readonly number[])[i] : (p as Record<string, number>)[k]) as number;

/**
 * Downsample a series to `threshold` points and keep its visual shape (Largest-Triangle-Three-Buckets).
 * @param points input, sorted by x
 * @param threshold wanted output length (≥ 3; smaller values return the input)
 * @param getX default `p[0]` (or `p.x`)
 * @param getY default `p[1]` (or `p.y`)
 */
export function lttb<T>(points: readonly T[], threshold: number, getX: (p: T) => number = (p) => coord(p, 0, "x"), getY: (p: T) => number = (p) => coord(p, 1, "y")): T[] {
  const n = points.length;
  if (!(threshold >= 3) || threshold >= n) return points.slice();
  const at = (j: number): T => points[j] as T;
  const out: T[] = [at(0)];
  const every = (n - 2) / (threshold - 2);
  let a = 0;
  for (let i = 0; i < threshold - 2; i++) {
    // average of the next bucket
    let avgX = 0, avgY = 0;
    const s = Math.floor((i + 1) * every) + 1, e = Math.min(Math.floor((i + 2) * every) + 1, n);
    for (let j = s; j < e; j++) { avgX += getX(at(j)); avgY += getY(at(j)); }
    const len = e - s || 1;
    avgX /= len; avgY /= len;
    // the point of this bucket that forms the largest triangle with the previous pick and that average
    const ax = getX(at(a)), ay = getY(at(a));
    let best = -1, pick = s - 1;
    for (let j = Math.floor(i * every) + 1, end = Math.floor((i + 1) * every) + 1; j < end; j++) {
      const area = Math.abs((ax - avgX) * (getY(at(j)) - ay) - (ax - getX(at(j))) * (avgY - ay));
      if (area > best) { best = area; pick = j; }
    }
    out.push(at(pick));
    a = pick;
  }
  out.push(at(n - 1));
  return out;
}
