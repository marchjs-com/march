// Bezier paths (pen tool, vector masks, shapes, text on a path, selections from paths): data, geometry, flattening,
// anti-aliased rasterizing to a mask and stroking to an outline.

import { Mask, type Rect } from "./tiles.ts";

/** One anchor: position, the two direction handles (absolute), and whether the handles move together. */
export interface Anchor {
  x: number; y: number;
  /** Incoming handle (before the anchor). */
  ix: number; iy: number;
  /** Outgoing handle (after the anchor). */
  ox: number; oy: number;
  /** "smooth": handles stay in line; "corner": independent; "symmetric": same length too. */
  type: "corner" | "smooth" | "symmetric";
}
export interface SubPath { anchors: Anchor[]; closed: boolean; /** combine with the paths before: */ op?: "add" | "subtract" | "intersect" | "exclude" | undefined }
export interface PathData { subpaths: SubPath[]; fillRule?: "nonzero" | "evenodd" }

export const anchor = (x: number, y: number, type: Anchor["type"] = "corner"): Anchor => ({ x, y, ix: x, iy: y, ox: x, oy: y, type });

export const emptyPath = (): PathData => ({ subpaths: [] });

export function clonePath(p: PathData): PathData {
  return { fillRule: p.fillRule, subpaths: p.subpaths.map((s) => ({ closed: s.closed, op: s.op, anchors: s.anchors.map((a) => ({ ...a })) })) };
}

// ——— builders ———

export function rectPath(x: number, y: number, w: number, h: number, r: number | [number, number, number, number] = 0): PathData {
  const [tl, tr, br, bl] = typeof r === "number" ? [r, r, r, r] : r;
  const k = 0.5522847498;
  if (!tl && !tr && !br && !bl) return { subpaths: [{ closed: true, anchors: [anchor(x, y), anchor(x + w, y), anchor(x + w, y + h), anchor(x, y + h)] }] };
  const a: Anchor[] = [];
  const corner = (cx: number, cy: number, rad: number, sx: number, sy: number, first: boolean): void => {
    // the arc from (cx + sx·rad·?, …) — four corners in clockwise order, each two anchors
    if (!rad) { a.push(anchor(cx, cy)); return; }
    const p1 = first ? [cx, cy + sy * rad] : [cx + sx * rad, cy];
    const p2 = first ? [cx + sx * rad, cy] : [cx, cy + sy * rad];
    const A: Anchor = anchor(p1[0]!, p1[1]!, "smooth"), B: Anchor = anchor(p2[0]!, p2[1]!, "smooth");
    A.ox = p1[0]! + (cx - p1[0]!) * k; A.oy = p1[1]! + (cy - p1[1]!) * k;
    B.ix = p2[0]! + (cx - p2[0]!) * k; B.iy = p2[1]! + (cy - p2[1]!) * k;
    a.push(A, B);
  };
  corner(x, y, Math.min(tl, w / 2, h / 2), 1, 1, true);
  corner(x + w, y, Math.min(tr, w / 2, h / 2), -1, 1, false);
  corner(x + w, y + h, Math.min(br, w / 2, h / 2), -1, -1, true);
  corner(x, y + h, Math.min(bl, w / 2, h / 2), 1, -1, false);
  return { subpaths: [{ closed: true, anchors: a }] };
}

export function ellipsePath(cx: number, cy: number, rx: number, ry: number): PathData {
  const k = 0.5522847498, a: Anchor[] = [];
  const pts: [number, number, number, number][] = [[cx, cy - ry, rx * k, 0], [cx + rx, cy, 0, ry * k], [cx, cy + ry, -rx * k, 0], [cx - rx, cy, 0, -ry * k]];
  for (const [x, y, dx, dy] of pts) a.push({ x, y, ix: x - dx, iy: y - dy, ox: x + dx, oy: y + dy, type: "symmetric" });
  return { subpaths: [{ closed: true, anchors: a }] };
}

export function polygonPath(cx: number, cy: number, r: number, sides: number, star = 0, angle = 0): PathData {
  const n = Math.max(3, Math.round(sides)), a: Anchor[] = [];
  for (let i = 0; i < n * (star > 0 ? 2 : 1); i++) {
    const inner = star > 0 && i % 2 === 1;
    const rad = inner ? r * (1 - star) : r;
    const t = angle - Math.PI / 2 + (i * Math.PI * 2) / (n * (star > 0 ? 2 : 1));
    a.push(anchor(cx + Math.cos(t) * rad, cy + Math.sin(t) * rad));
  }
  return { subpaths: [{ closed: true, anchors: a }] };
}

export function polylinePath(points: [number, number][], closed: boolean): PathData {
  return { subpaths: [{ closed, anchors: points.map(([x, y]) => anchor(x, y)) }] };
}

// ——— geometry ———

const cubic = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

/** Flatten a subpath to points (tolerance in pixels). */
export function flatten(sp: SubPath, tol = 0.25): [number, number][] {
  const out: [number, number][] = [];
  const A = sp.anchors;
  if (!A.length) return out;
  out.push([A[0]!.x, A[0]!.y]);
  const segs = sp.closed ? A.length : A.length - 1;
  for (let i = 0; i < segs; i++) {
    const a = A[i]!, b = A[(i + 1) % A.length]!;
    const straight = a.ox === a.x && a.oy === a.y && b.ix === b.x && b.iy === b.y;
    if (straight) { out.push([b.x, b.y]); continue; }
    const len = Math.hypot(a.ox - a.x, a.oy - a.y) + Math.hypot(b.ix - a.ox, b.iy - a.oy) + Math.hypot(b.x - b.ix, b.y - b.iy);
    const n = Math.max(2, Math.min(200, Math.ceil(Math.sqrt(len / tol))));
    for (let s = 1; s <= n; s++) {
      const t = s / n;
      out.push([cubic(a.x, a.ox, b.ix, b.x, t), cubic(a.y, a.oy, b.iy, b.y, t)]);
    }
  }
  return out;
}

export function pathBounds(p: PathData): Rect | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const sp of p.subpaths) for (const [x, y] of flatten(sp, 1)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return x1 < x0 ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Apply an affine [a, b, c, d, e, f] (x' = a·x + c·y + e, y' = b·x + d·y + f) to every point and handle. */
export function transformPath(p: PathData, m: number[]): PathData {
  const q = clonePath(p);
  const tx = (x: number, y: number): [number, number] => [m[0]! * x + m[2]! * y + m[4]!, m[1]! * x + m[3]! * y + m[5]!];
  for (const sp of q.subpaths) for (const a of sp.anchors) {
    [a.x, a.y] = tx(a.x, a.y); [a.ix, a.iy] = tx(a.ix, a.iy); [a.ox, a.oy] = tx(a.ox, a.oy);
  }
  return q;
}

/** Nearest point on the path: subpath, segment index, t and distance. */
export function hitPath(p: PathData, x: number, y: number): { sub: number; seg: number; t: number; dist: number } | null {
  let best: { sub: number; seg: number; t: number; dist: number } | null = null;
  p.subpaths.forEach((sp, si) => {
    const A = sp.anchors, segs = sp.closed ? A.length : A.length - 1;
    for (let i = 0; i < segs; i++) {
      const a = A[i]!, b = A[(i + 1) % A.length]!;
      for (let s = 0; s <= 32; s++) {
        const t = s / 32;
        const d = Math.hypot(cubic(a.x, a.ox, b.ix, b.x, t) - x, cubic(a.y, a.oy, b.iy, b.y, t) - y);
        if (!best || d < best.dist) best = { sub: si, seg: i, t, dist: d };
      }
    }
  });
  return best;
}

/** Split segment `seg` of subpath `sub` at t (de Casteljau): adds an anchor, the curve keeps its shape. */
export function splitSegment(p: PathData, sub: number, seg: number, t: number): PathData {
  const q = clonePath(p), A = q.subpaths[sub]!.anchors, a = A[seg]!, b = A[(seg + 1) % A.length]!;
  const lerp = (u: number, v: number): number => u + (v - u) * t;
  const p01x = lerp(a.x, a.ox), p01y = lerp(a.y, a.oy), p12x = lerp(a.ox, b.ix), p12y = lerp(a.oy, b.iy), p23x = lerp(b.ix, b.x), p23y = lerp(b.iy, b.y);
  const p012x = lerp(p01x, p12x), p012y = lerp(p01y, p12y), p123x = lerp(p12x, p23x), p123y = lerp(p12y, p23y);
  const mx = lerp(p012x, p123x), my = lerp(p012y, p123y);
  a.ox = p01x; a.oy = p01y; b.ix = p23x; b.iy = p23y;
  A.splice(seg + 1, 0, { x: mx, y: my, ix: p012x, iy: p012y, ox: p123x, oy: p123y, type: "smooth" });
  return q;
}

// ——— rasterizing ———

/** Edges of polygons for scanline filling. */
function edgesOf(polys: [number, number][][]): Float64Array {
  let n = 0;
  for (const p of polys) n += p.length;
  const e = new Float64Array(n * 5);
  let k = 0;
  for (const p of polys) {
    for (let i = 0; i < p.length; i++) {
      const [x0, y0] = p[i]!, [x1, y1] = p[(i + 1) % p.length]!;
      if (y0 === y1) continue;
      const dir = y1 > y0 ? 1 : -1;
      const ya = Math.min(y0, y1), yb = Math.max(y0, y1), xa = y0 < y1 ? x0 : x1;
      e[k++] = ya; e[k++] = yb; e[k++] = xa; e[k++] = (x1 - x0) / (y1 - y0); e[k++] = dir;
    }
  }
  return e.subarray(0, k);
}

/**
 * Fill polygons into a coverage buffer (0–1 per pixel, document space) with 4 sub-scanlines and exact horizontal
 * coverage. `cb(x, y, coverage)` gets each covered pixel.
 */
export function fillPolygons(polys: [number, number][][], rule: "nonzero" | "evenodd", clip: Rect, cb: (x: number, y: number, c: number) => void): void {
  const E = edgesOf(polys), ne = E.length / 5;
  if (!ne) return;
  const SUB = 4;
  const row = new Float32Array(clip.w + 2);
  const xs: number[] = [], ws: number[] = [];
  for (let y = clip.y; y < clip.y + clip.h; y++) {
    row.fill(0);
    let any = false;
    for (let s = 0; s < SUB; s++) {
      const sy = y + (s + 0.5) / SUB;
      xs.length = 0; ws.length = 0;
      for (let i = 0; i < ne; i++) {
        const o = i * 5;
        if (sy < E[o]! || sy >= E[o + 1]!) continue;
        xs.push(E[o + 2]! + (sy - E[o]!) * E[o + 3]!); ws.push(E[o + 4]!);
      }
      if (xs.length < 2) continue;
      const idx = xs.map((_, i) => i).sort((a, b) => xs[a]! - xs[b]!);
      let wind = 0;
      for (let j = 0; j < idx.length - 1; j++) {
        wind += ws[idx[j]!]!;
        const inside = rule === "evenodd" ? (j + 1) % 2 === 1 : wind !== 0;
        if (!inside) continue;
        let xa = xs[idx[j]!]! - clip.x, xb = xs[idx[j + 1]!]! - clip.x;
        if (xb <= 0 || xa >= clip.w) continue;
        xa = Math.max(0, xa); xb = Math.min(clip.w, xb);
        any = true;
        const ia = Math.floor(xa), ib = Math.floor(xb);
        if (ia === ib) row[ia]! += (xb - xa) / SUB;
        else {
          row[ia]! += (ia + 1 - xa) / SUB;
          for (let x = ia + 1; x < ib; x++) row[x]! += 1 / SUB;
          if (ib < clip.w) row[ib]! += (xb - ib) / SUB;
        }
      }
    }
    if (any) for (let x = 0; x < clip.w; x++) if (row[x]! > 0) cb(clip.x + x, y, Math.min(1, row[x]!));
  }
}

/** A path as a mask (selection from path, vector mask, shape fill). */
export function pathToMask(p: PathData, width: number, height: number, antialias = true): Mask {
  const m = new Mask(width, height);
  const polys = p.subpaths.filter((s) => s.anchors.length > 1).map((s) => flatten(s));
  const d = m.data;
  fillPolygons(polys, p.fillRule ?? "nonzero", { x: 0, y: 0, w: width, h: height }, (x, y, c) => {
    d[y * width + x] = antialias ? Math.round(c * 255) : c >= 0.5 ? 255 : 0;
  });
  return m;
}

/** The outline polygons of a stroked polyline (round joins and caps approximated with polygons per segment). */
export function strokePolygons(pts: [number, number][], closed: boolean, width: number, cap: "butt" | "round" | "square" = "round"): [number, number][][] {
  const r = width / 2, out: [number, number][][] = [];
  const n = pts.length, segs = closed ? n : n - 1;
  const disc = (x: number, y: number): [number, number][] => {
    const k = Math.max(8, Math.min(64, Math.ceil(r * 1.5))), c: [number, number][] = [];
    for (let i = 0; i < k; i++) c.push([x + Math.cos((i / k) * Math.PI * 2) * r, y + Math.sin((i / k) * Math.PI * 2) * r]);
    return c;
  };
  for (let i = 0; i < segs; i++) {
    const [x0, y0] = pts[i]!, [x1, y1] = pts[(i + 1) % n]!;
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 1e-9) continue;
    const nx = (-(y1 - y0) / len) * r, ny = ((x1 - x0) / len) * r;
    let ex = 0, ey = 0;
    if (!closed && cap === "square") { ex = ((x1 - x0) / len) * r; ey = ((y1 - y0) / len) * r; }
    const sx = i === 0 ? ex : 0, sy = i === 0 ? ey : 0, fx = i === segs - 1 ? ex : 0, fy = i === segs - 1 ? ey : 0;
    out.push([[x0 + nx - sx, y0 + ny - sy], [x1 + nx + fx, y1 + ny + fy], [x1 - nx + fx, y1 - ny + fy], [x0 - nx - sx, y0 - ny - sy]]);
  }
  // joins and round caps as discs (filled with nonzero, overlaps merge)
  for (let i = 0; i < n; i++) {
    const end = !closed && (i === 0 || i === n - 1);
    if (end ? cap === "round" : true) out.push(disc(pts[i]![0]!, pts[i]![1]!));
  }
  // one winding direction for every piece, so overlaps add up under nonzero instead of cancelling
  for (const poly of out) if (signedArea(poly) < 0) poly.reverse();
  return out;
}

export function signedArea(poly: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) { const [x0, y0] = poly[i]!, [x1, y1] = poly[(i + 1) % poly.length]!; a += x0 * y1 - x1 * y0; }
  return a / 2;
}
