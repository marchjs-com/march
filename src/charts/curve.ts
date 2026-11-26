// Line shapes: how a series runs between its points. Points are screen coordinates; a null breaks the line (a gap).
import { f1 } from "./util.ts";

/** "linear" (default), "smooth" (monotone: never overshoots the data), "step" (middle), "step-before", "step-after". */
export type Curve = "linear" | "smooth" | "step" | "step-before" | "step-after";
export type Pt = readonly [number, number];

/** Path commands through `pts` (one run, no gaps) without the leading M. */
function run(pts: readonly Pt[], curve: Curve): string {
  const p = (q: Pt): string => `${f1(q[0])},${f1(q[1])}`;
  if (pts.length < 2 || curve === "linear") return pts.map(p).join("L");
  let s = p(pts[0] as Pt);
  if (curve === "smooth") {
    // monotone cubic (Fritsch–Carlson) in x
    const n = pts.length, d: number[] = [], m: number[] = [];
    for (let i = 0; i < n - 1; i++) { const a = pts[i] as Pt, b = pts[i + 1] as Pt; d.push((b[1] - a[1]) / ((b[0] - a[0]) || 1e-9)); }
    m[0] = d[0] as number; m[n - 1] = d[n - 2] as number;
    for (let i = 1; i < n - 1; i++) { const a = d[i - 1] as number, b = d[i] as number; m[i] = a * b <= 0 ? 0 : (3 * (a + b)) / ((2 * b + a) / a + (b + 2 * a) / b); }
    for (let i = 0; i < n - 1; i++) {
      const a = pts[i] as Pt, b = pts[i + 1] as Pt, h = (b[0] - a[0]) / 3;
      s += `C${f1(a[0] + h)},${f1(a[1] + (m[i] as number) * h)} ${f1(b[0] - h)},${f1(b[1] - (m[i + 1] as number) * h)} ${p(b)}`;
    }
    return s;
  }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Pt, b = pts[i] as Pt;
    if (curve === "step-after") s += `L${f1(b[0])},${f1(a[1])}L${p(b)}`;
    else if (curve === "step-before") s += `L${f1(a[0])},${f1(b[1])}L${p(b)}`;
    else { const mx = (a[0] + b[0]) / 2; s += `L${f1(mx)},${f1(a[1])}L${f1(mx)},${f1(b[1])}L${p(b)}`; }
  }
  return s;
}

/** Runs of consecutive non-null points (null = gap). */
export function runs(pts: readonly (Pt | null)[]): Pt[][] {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  for (const q of pts) { if (!q || !isFinite(q[0]) || !isFinite(q[1])) { if (cur.length) out.push(cur), (cur = []); } else cur.push(q); }
  if (cur.length) out.push(cur);
  return out;
}

/** A line through the points; nulls leave gaps (or, with `connect`, are skipped). */
export function linePath(pts: readonly (Pt | null)[], curve: Curve = "linear", connect = false): string {
  const parts = connect ? [pts.filter((q): q is Pt => !!q)] : runs(pts);
  return parts.filter((r) => r.length).map((r) => `M${run(r, curve)}`).join("");
}

/** A filled band between `top` and `base` (same length; base is drawn back along the same curve). */
export function areaPath(top: readonly (Pt | null)[], base: readonly (Pt | null)[], curve: Curve = "linear"): string {
  let out = "", t: Pt[] = [], b: Pt[] = [];
  const flush = (): void => {
    if (t.length) out += `M${run(t, curve)}L${run(b.slice().reverse(), curve === "step-after" ? "step-before" : curve === "step-before" ? "step-after" : curve)}Z`;
    t = []; b = [];
  };
  top.forEach((q, i) => { const r = base[i]; if (q && r) { t.push(q); b.push(r); } else flush(); });
  flush();
  return out;
}

/** Stroke dash pattern for a line style: "solid" (none), "dashed", "dotted", or a dash array as written. */
export const dashOf = (s: string | null | undefined): string | null => (!s || s === "solid" ? null : s === "dashed" ? "6 4" : s === "dotted" ? "1.5 3.5" : s);
