// The oscilloscope's maths, apart from drawing (tested on its own): where a sweep starts (the trigger) and how long one
// period of the signal is (for the X/Y figure of a mono input).

/**
 * The first sample at or after `from` where the signal rises through `level` (a stable picture: every sweep starts at
 * the same phase). -1 when it never does within `[from, end)`.
 */
export function triggerIndex(s: ArrayLike<number>, level = 0, from = 1, end = s.length): number {
  for (let i = Math.max(1, from); i < end; i++) if (s[i - 1]! < level && s[i]! >= level) return i;
  return -1;
}

/** Samples between two rising crossings of `level` (one period); 0 when there are not two. */
export function periodOf(s: ArrayLike<number>, level = 0): number {
  const a = triggerIndex(s, level);
  if (a < 0) return 0;
  const b = triggerIndex(s, level, a + 1);
  return b < 0 ? 0 : b - a;
}

/** True when the right channel says nothing new: silent, or the same as the left (a mono input). */
export function isMono(l: ArrayLike<number>, r: ArrayLike<number>): boolean {
  let d = 0, e = 0;
  for (let i = 0; i < l.length; i++) { d += Math.abs(l[i]! - r[i]!); e += Math.abs(r[i]!); }
  return d < 1e-3 * l.length || e < 1e-3 * l.length;
}
