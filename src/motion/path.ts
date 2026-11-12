// SVG path geometry for the motion helpers (pure, no DOM): parse a `d` string, flatten it into polylines, sample a
// point by distance, resample shapes with different point counts to the same count, and interpolate two paths.
//   const at = pathSampler("M0 0 C 50 -40 100 40 150 0");  at(0.5) → { x, y, angle }
//   const mix = interpolatePath(starD, circleD);           mix(0.3) → a `d` string between them
// Paths with the same commands interpolate number by number (curves stay curves); others are resampled.

export interface PathPoint { x: number; y: number; angle: number }
type Seg = { c: string; v: number[] };
type Poly = { pts: number[]; closed: boolean };

const CMD = /([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g;
const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
const ARGS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/** Split a `d` string into commands with their numbers (implicit repeats made explicit). */
export function parsePath(d: string): Seg[] {
  const out: Seg[] = [];
  for (const m of d.matchAll(CMD)) {
    const c = m[1]!, nums = (m[2]!.match(NUM) ?? []).map(Number), n = ARGS[c.toUpperCase()]!;
    if (!n) { out.push({ c, v: [] }); continue; }
    for (let i = 0; i < nums.length; i += n) {
      // repeated pairs after a moveto are linetos
      const cc = i > 0 && c === "M" ? "L" : i > 0 && c === "m" ? "l" : c;
      out.push({ c: cc, v: nums.slice(i, i + n) });
    }
  }
  return out;
}

const cubic = (a: number, b: number, c: number, d: number, t: number): number => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };
const quad = (a: number, b: number, c: number, t: number): number => { const u = 1 - t; return u * u * a + 2 * u * t * b + t * t * c; };

/** Flatten into polylines (one per subpath); curves become `steps` segments each. */
export function flatten(d: string, steps = 16): Poly[] {
  const polys: Poly[] = [];
  let cur: Poly | null = null, x = 0, y = 0, sx = 0, sy = 0, lc = "", cx = 0, cy = 0;
  const to = (nx: number, ny: number): void => { if (!cur) polys.push((cur = { pts: [x, y], closed: false })); cur.pts.push(nx, ny); x = nx; y = ny; };
  for (const { c, v } of parsePath(d)) {
    const rel = c === c.toLowerCase() && c !== "z", C = c.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === "M") { x = sx = v[0]! + ox; y = sy = v[1]! + oy; polys.push((cur = { pts: [x, y], closed: false })); }
    else if (C === "L") to(v[0]! + ox, v[1]! + oy);
    else if (C === "H") to(v[0]! + ox, y);
    else if (C === "V") to(x, v[0]! + (rel ? y : 0));
    else if (C === "C" || C === "S") {
      const [x1, y1] = C === "C" ? [v[0]! + ox, v[1]! + oy] : /[CS]/.test(lc) ? [2 * x - cx, 2 * y - cy] : [x, y];
      const k = C === "C" ? 2 : 0;
      const x2 = v[k]! + ox, y2 = v[k + 1]! + oy, ex = v[k + 2]! + ox, ey = v[k + 3]! + oy, x0 = x, y0 = y;
      for (let i = 1; i <= steps; i++) to(cubic(x0, x1, x2, ex, i / steps), cubic(y0, y1, y2, ey, i / steps));
      cx = x2; cy = y2;
    } else if (C === "Q" || C === "T") {
      const [x1, y1] = C === "Q" ? [v[0]! + ox, v[1]! + oy] : /[QT]/.test(lc) ? [2 * x - cx, 2 * y - cy] : [x, y];
      const k = C === "Q" ? 2 : 0;
      const ex = v[k]! + ox, ey = v[k + 1]! + oy, x0 = x, y0 = y;
      for (let i = 1; i <= steps; i++) to(quad(x0, x1, ex, i / steps), quad(y0, y1, ey, i / steps));
      cx = x1; cy = y1;
    } else if (C === "A") arc(x, y, v[0]!, v[1]!, v[2]!, v[3]!, v[4]!, v[5]! + ox, v[6]! + oy, steps, to);
    else if (C === "Z") { if (cur) { cur.closed = true; if (x !== sx || y !== sy) to(sx, sy); } x = sx; y = sy; cur = null; }
    lc = C;
  }
  return polys.filter((p) => p.pts.length >= 4);
}

// elliptical arc (endpoint form) → points, per SVG 1.1 F.6.5
function arc(x1: number, y1: number, rx: number, ry: number, rot: number, large: number, sweep: number, x2: number, y2: number, steps: number, to: (x: number, y: number) => void): void {
  if (!rx || !ry) { to(x2, y2); return; }
  const phi = (rot * Math.PI) / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const xp = cos * dx + sin * dy, yp = -sin * dx + cos * dy;
  rx = Math.abs(rx); ry = Math.abs(ry);
  const l = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (l > 1) { rx *= Math.sqrt(l); ry *= Math.sqrt(l); }
  const s = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, (rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp) / (rx * rx * yp * yp + ry * ry * xp * xp)));
  const cxp = (s * rx * yp) / ry, cyp = (-s * ry * xp) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number): number => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(2, Math.ceil((Math.abs(dt) / (Math.PI / 2)) * (steps / 2)));
  for (let i = 1; i <= n; i++) {
    const t = t1 + (dt * i) / n;
    to(cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos);
  }
}

const lengths = (pts: number[]): number[] => {
  const acc = [0];
  for (let i = 2; i < pts.length; i += 2) acc.push(acc[acc.length - 1]! + Math.hypot(pts[i]! - pts[i - 2]!, pts[i + 1]! - pts[i - 1]!));
  return acc;
};

/** Total length of a path (all subpaths). */
export function pathLength(d: string): number {
  return flatten(d).reduce((s, p) => s + lengths(p.pts).at(-1)!, 0);
}

/** A sampler along the path: `at(p)` for p in 0..1 gives the point and the tangent angle (degrees). */
export function pathSampler(d: string): (p: number) => PathPoint {
  const pts = flatten(d).flatMap((p) => p.pts);
  const acc = lengths(pts), total = acc.at(-1) || 1;
  return (p: number): PathPoint => {
    const target = Math.min(1, Math.max(0, p)) * total;
    let lo = 0, hi = acc.length - 1;
    while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (acc[mid]! < target) lo = mid; else hi = mid; }
    const seg = acc[hi]! - acc[lo]! || 1, t = Math.min(1, (target - acc[lo]!) / seg);
    const ax = pts[lo * 2] ?? 0, ay = pts[lo * 2 + 1] ?? 0, bx = pts[hi * 2] ?? ax, by = pts[hi * 2 + 1] ?? ay;
    return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, angle: (Math.atan2(by - ay, bx - ax) * 180) / Math.PI };
  };
}

/** `n` points evenly spaced along the path's longest subpath: [x0, y0, x1, y1, …]. */
export function resample(d: string, n = 64): { pts: number[]; closed: boolean } {
  const polys = flatten(d);
  const main = polys.reduce((a, b) => (lengths(b.pts).at(-1)! > lengths(a.pts).at(-1)! ? b : a), polys[0] ?? { pts: [0, 0, 0, 0], closed: false });
  const at = pathSampler(toD(main.pts, false));
  const out: number[] = [];
  // a closed shape must not repeat its first point at the end
  const div = main.closed ? n : n - 1;
  for (let i = 0; i < n; i++) { const q = at(i / div); out.push(q.x, q.y); }
  return { pts: out, closed: main.closed };
}

const r2 = (v: number): number => Math.round(v * 100) / 100;
/** Points → `d`. */
export const toD = (pts: ArrayLike<number>, closed: boolean): string => {
  let s = "";
  for (let i = 0; i < pts.length; i += 2) s += `${i ? "L" : "M"}${r2(pts[i]!)} ${r2(pts[i + 1]!)}`;
  return closed ? s + "Z" : s;
};

// rotate the start of a closed shape so its points line up with the other shape's (least travel)
function align(a: number[], b: number[]): number[] {
  const n = a.length / 2;
  let best = 0, bestD = Infinity;
  for (let s = 0; s < n; s++) {
    let d = 0;
    for (let i = 0; i < n; i++) { const j = ((i + s) % n) * 2; d += (a[i * 2]! - b[j]!) ** 2 + (a[i * 2 + 1]! - b[j + 1]!) ** 2; }
    if (d < bestD) { bestD = d; best = s; }
  }
  return Array.from({ length: n * 2 }, (_, k) => b[((Math.floor(k / 2) + best) % n) * 2 + (k % 2)]!);
}

/** A mixer between two paths: `mix(t)` → `d`. Same command list → numbers tween; otherwise both are resampled. */
export function interpolatePath(from: string, to: string, o: { points?: number } = {}): (t: number) => string {
  const a = parsePath(from), b = parsePath(to);
  if (a.length === b.length && a.every((s, i) => s.c === b[i]!.c && s.v.length === b[i]!.v.length)) {
    return (t) => {
      if (t <= 0) return from;
      if (t >= 1) return to;
      return a.map((s, i) => s.c + s.v.map((v, k) => (s.c.toUpperCase() === "A" && k >= 2 && k <= 4 ? v : r2(v + (b[i]!.v[k]! - v) * t))).join(" ")).join("");
    };
  }
  const n = o.points ?? 72;
  const A = resample(from, n), B = resample(to, n);
  const bp = A.closed && B.closed ? align(A.pts, B.pts) : B.pts;
  const buf = new Array<number>(A.pts.length);
  return (t) => {
    if (t <= 0) return from;
    if (t >= 1) return to;
    for (let i = 0; i < buf.length; i++) buf[i] = A.pts[i]! + (bp[i]! - A.pts[i]!) * t;
    return toD(buf, A.closed && B.closed);
  };
}
