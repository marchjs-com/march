// Polar geometry shared by round charts (pie, radar, radial bars, sunburst, chord, gauges): angles are radians,
// clockwise from 12 o'clock.
export const TAU = Math.PI * 2;
const f2 = (v: number): number => Math.round(v * 100) / 100;

/** The point at angle `a` on a circle of radius `r` around (cx, cy). */
export const polar = (cx: number, cy: number, r: number, a: number): [number, number] => [cx + r * Math.sin(a), cy - r * Math.cos(a)];

/** SVG path for an annular sector (r0 = 0 for a pie slice; a full turn draws a ring). */
export function arcPath(cx: number, cy: number, r: number, r0: number, a0: number, a1: number): string {
  const pt = (rad: number, a: number): string => `${f2(cx + rad * Math.sin(a))},${f2(cy - rad * Math.cos(a))}`;
  if (a1 - a0 >= TAU - 1e-9) { // full circle: two half arcs
    const ring = (rad: number, sweep: number): string => `M${pt(rad, 0)}A${rad},${rad} 0 1 ${sweep} ${pt(rad, Math.PI)}A${rad},${rad} 0 1 ${sweep} ${pt(rad, 0)}Z`;
    return ring(r, 1) + (r0 > 0 ? ring(r0, 0) : "");
  }
  if (a1 <= a0) return "";
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const outer = `M${pt(r, a0)}A${r},${r} 0 ${large} 1 ${pt(r, a1)}`;
  return r0 > 0 ? `${outer}L${pt(r0, a1)}A${r0},${r0} 0 ${large} 0 ${pt(r0, a0)}Z` : `${outer}L${f2(cx)},${f2(cy)}Z`;
}

/** An open arc (a stroke only, e.g. a track or a gauge band) from a0 to a1. */
export function arcLine(cx: number, cy: number, r: number, a0: number, a1: number): string {
  if (a1 - a0 >= TAU - 1e-9) a1 = a0 + TAU - 1e-4;
  if (a1 <= a0) return "";
  const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1);
  return `M${f2(x0)},${f2(y0)}A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${f2(x1)},${f2(y1)}`;
}

/** Closed polygon through points at equal angles (radar rings and shapes): `radii[i]` at angle i·2π/n. */
export function polygonPath(cx: number, cy: number, radii: readonly number[]): string {
  const n = radii.length;
  if (!n) return "";
  return `M${radii.map((r, i) => polar(cx, cy, r, (i * TAU) / n).map(f2).join(",")).join("L")}Z`;
}
