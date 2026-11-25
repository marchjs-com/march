// The spectrum's maths, apart from drawing (tested on its own): bar edges in Hz (log or linear) and each bar's value
// from the analyser's bins.

/** `bars + 1` edges in Hz from `minHz` to `maxHz`, spaced evenly on a log (default) or linear scale. */
export function barEdges(bars: number, minHz: number, maxHz: number, scale: "log" | "linear" = "log"): Float32Array {
  const n = Math.max(1, Math.round(bars)), lo = Math.max(1, Math.min(minHz, maxHz - 1)), hi = Math.max(lo + 1, maxHz);
  const out = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) out[i] = scale === "linear" ? lo + ((hi - lo) * i) / n : lo * (hi / lo) ** (i / n);
  return out;
}

/**
 * Each bar's value 0–1 into `out`: the mean of the bins inside its edges, or (a bar narrower than a bin, the low end of
 * a log scale) the bins around its middle blended by distance. Bin i sits at i × rate / (2 × bins) Hz.
 */
export function barValues(spec: ArrayLike<number>, edges: ArrayLike<number>, rate: number, out: Float32Array, gain = 1): Float32Array {
  const bins = spec.length, perHz = (2 * bins) / rate;
  for (let b = 0; b + 1 < edges.length; b++) {
    const from = edges[b]! * perHz, to = edges[b + 1]! * perHz;
    const a = Math.ceil(from), z = Math.min(bins - 1, Math.floor(to));
    let v: number;
    if (z >= a) { let s = 0; for (let i = a; i <= z; i++) s += spec[i]!; v = s / (z - a + 1); }
    else {
      const mid = Math.min(bins - 1, (from + to) / 2), i = Math.floor(mid), f = mid - i;
      v = (spec[i] ?? 0) * (1 - f) + (spec[Math.min(bins - 1, i + 1)] ?? 0) * f;
    }
    v *= gain;
    out[b] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
  return out;
}
