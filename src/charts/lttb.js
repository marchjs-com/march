// Largest-Triangle-Three-Buckets downsampling (Steinarsson, 2013): keeps the visual shape of a series with far fewer points.
// Returns a subset of the input items (same references), always including the first and the last item.

/**
 * @template T
 * @param {T[]} points input, sorted by x
 * @param {number} threshold wanted output length (≥ 3; smaller values return the input)
 * @param {(p: T) => number} [getX] default `p[0]` (or `p.x`)
 * @param {(p: T) => number} [getY] default `p[1]` (or `p.y`)
 * @returns {T[]}
 */
export function lttb(points, threshold, getX = (p) => (Array.isArray(p) ? p[0] : p.x), getY = (p) => (Array.isArray(p) ? p[1] : p.y)) {
  const n = points.length;
  if (!(threshold >= 3) || threshold >= n) return points.slice();
  const out = [points[0]];
  const every = (n - 2) / (threshold - 2);
  let a = 0;
  for (let i = 0; i < threshold - 2; i++) {
    // average of the next bucket
    let avgX = 0, avgY = 0;
    const s = Math.floor((i + 1) * every) + 1, e = Math.min(Math.floor((i + 2) * every) + 1, n);
    for (let j = s; j < e; j++) { avgX += getX(points[j]); avgY += getY(points[j]); }
    const len = e - s || 1;
    avgX /= len; avgY /= len;
    // the point of this bucket that forms the largest triangle with the previous pick and that average
    const ax = getX(points[a]), ay = getY(points[a]);
    let best = -1, pick = s - 1;
    for (let j = Math.floor(i * every) + 1, end = Math.floor((i + 1) * every) + 1; j < end; j++) {
      const area = Math.abs((ax - avgX) * (getY(points[j]) - ay) - (ax - getX(points[j])) * (avgY - ay));
      if (area > best) { best = area; pick = j; }
    }
    out.push(points[pick]);
    a = pick;
  }
  out.push(points[n - 1]);
  return out;
}
