// Healing family: spot healing brush (proximity match / create texture / content-aware through an injected hook with
// a patch-search texture synthesis fallback), healing brush (Alt+click source; the source's texture takes the
// destination's color by solving a Laplace equation over the stroke region), patch tool (source / destination,
// transparent, diffusion), content-aware move (hook, or move-and-heal fallback) and red eye (pupil size, darken; finds
// the red disk around the click).
//
// The seamless blend: result = source + c, where Δc = 0 inside the region and c = destination − source on its border.
// c is solved per channel by Gauss–Seidel (over-relaxed) on a cascade of half-size grids: each coarser solution seeds
// the finer one, so a few dozen sweeps per level converge even on large regions.

import { blurPlane } from "../alpha.ts";
import type { ImageDocument } from "../document.ts";
import type { Layer, Pattern, RGBA } from "../layers.ts";
import { renderPattern } from "../paint.ts";
import { combine, polygonMask } from "../selection.ts";
import { Mask, TILE, tileKey, type Rect } from "../tiles.ts";
import { PaintSurface, findPattern, paintBlocker, type PaintMode } from "../brush/engine.ts";
import { rng } from "../brush/tips.ts";
import { paintOver } from "./fill.ts";
import {
  bool, choice, optBool, optBrush, optHardness, optMode, optNum, optPct, optSampleAll, optSize, optStr, pct, readMerged, sampleSource,
  strokeTool, type PaintHooks, type PaintTool, type PixelSource,
} from "./paint-common.ts";
import { setSource, sourceOffset, sourceOverlay } from "./stamp.ts";
import type { OverlayShape, ToolContext } from "./tool.ts";

// ——— the solver ———

/** Solve Δc = 0 where `inside`, c fixed elsewhere; `c` holds 3 interleaved channels and is updated in place. */
function laplace(c: Float32Array, inside: Uint8Array, w: number, h: number, sweeps: number): void {
  if (w > 24 && h > 24) {
    const w2 = (w + 1) >> 1, h2 = (h + 1) >> 1, in2 = new Uint8Array(w2 * h2), c2 = new Float32Array(w2 * h2 * 3);
    for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
      let any = 0, n = 0, s0 = 0, s1 = 0, s2 = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const X = x * 2 + dx, Y = y * 2 + dy;
        if (X >= w || Y >= h) continue;
        const i = Y * w + X;
        if (inside[i]) any = 1;
        else { n++; s0 += c[i * 3]!; s1 += c[i * 3 + 1]!; s2 += c[i * 3 + 2]!; }
      }
      const j = y * w2 + x;
      in2[j] = any;
      if (n) { c2[j * 3] = s0 / n; c2[j * 3 + 1] = s1 / n; c2[j * 3 + 2] = s2 / n; }
    }
    laplace(c2, in2, w2, h2, sweeps);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!inside[i]) continue;
      const j = (y >> 1) * w2 + (x >> 1);
      c[i * 3] = c2[j * 3]!; c[i * 3 + 1] = c2[j * 3 + 1]!; c[i * 3 + 2] = c2[j * 3 + 2]!;
    }
  } else sweeps = Math.max(sweeps, 300);
  const omega = 1.7;
  for (let it = 0; it < sweeps; it++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!inside[i]) continue;
      let n = 0, s0 = 0, s1 = 0, s2 = 0;
      if (x > 0) { const k = (i - 1) * 3; s0 += c[k]!; s1 += c[k + 1]!; s2 += c[k + 2]!; n++; }
      if (x < w - 1) { const k = (i + 1) * 3; s0 += c[k]!; s1 += c[k + 1]!; s2 += c[k + 2]!; n++; }
      if (y > 0) { const k = (i - w) * 3; s0 += c[k]!; s1 += c[k + 1]!; s2 += c[k + 2]!; n++; }
      if (y < h - 1) { const k = (i + w) * 3; s0 += c[k]!; s1 += c[k + 1]!; s2 += c[k + 2]!; n++; }
      if (!n) continue;
      const k = i * 3;
      c[k] = c[k]! + omega * (s0 / n - c[k]!); c[k + 1] = c[k + 1]! + omega * (s1 / n - c[k + 1]!); c[k + 2] = c[k + 2]! + omega * (s2 / n - c[k + 2]!);
    }
  }
}

/**
 * Seamless (Poisson) blend of `src` into `dst` over a region (straight RGBA, w×h): inside the mask (> 0) the result has
 * the source's detail and the destination's colors at the border. Returns straight RGBA (mask not yet applied).
 */
export function healBlend(src: Float32Array, dst: Float32Array, mask: Float32Array, w: number, h: number, sweeps = 40): Float32Array {
  const n = w * h, inside = new Uint8Array(n), c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    inside[i] = mask[i]! > 0 ? 1 : 0;
    // the border condition: the difference destination − source outside the region
    if (!inside[i]) for (let k = 0; k < 3; k++) c[i * 3 + k] = dst[i * 4 + k]! - src[i * 4 + k]!;
  }
  laplace(c, inside, w, h, sweeps);
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) out[i * 4 + k] = Math.max(0, Math.min(1, src[i * 4 + k]! + c[i * 3 + k]!));
    out[i * 4 + 3] = dst[i * 4 + 3]! > 0 ? Math.max(dst[i * 4 + 3]!, src[i * 4 + 3]!) : src[i * 4 + 3]!;
  }
  return out;
}

/**
 * Fill the masked pixels (mask ≥ 0.5) of a region in place from the known ones: onion-peel order from the border
 * inward, each pixel takes the center of the best-matching 7×7 known patch among coherent candidates (continuing a
 * neighbour's source) and random ones from the region. The fallback for content-aware fill until a hook is given.
 */
export function synthesizeFill(px: Float32Array, w: number, h: number, mask: Float32Array, seed = 1, candidates = 32): void {
  const n = w * h, R = 3, rand = rng(seed);
  const hole = new Uint8Array(n), filled = new Uint8Array(n), srcOf = new Int32Array(n).fill(-1);
  const known: number[] = [];
  for (let i = 0; i < n; i++) { if (mask[i]! >= 0.5) hole[i] = 1; else { filled[i] = 1; srcOf[i] = i; } }
  for (let i = 0; i < n; i++) {
    if (hole[i]) continue;
    const x = i % w, y = (i / w) | 0;
    if (x >= R && y >= R && x < w - R && y < h - R) known.push(i);
  }
  if (!known.length) for (let i = 0; i < n; i++) if (!hole[i]) known.push(i);
  if (!known.length) return;
  const cost = (p: number, q: number, best: number): number => {
    const px0 = p % w, py0 = (p / w) | 0, qx0 = q % w, qy0 = (q / w) | 0;
    let s = 0, cnt = 0;
    for (let dy = -R; dy <= R; dy++) {
      const py = py0 + dy, qy = qy0 + dy;
      if (py < 0 || py >= h || qy < 0 || qy >= h) continue;
      for (let dx = -R; dx <= R; dx++) {
        const pxx = px0 + dx, qx = qx0 + dx;
        if (pxx < 0 || pxx >= w || qx < 0 || qx >= w) continue;
        const a = py * w + pxx, b = qy * w + qx;
        if (!filled[a] || hole[b]) continue;
        const d0 = px[a * 4]! - px[b * 4]!, d1 = px[a * 4 + 1]! - px[b * 4 + 1]!, d2 = px[a * 4 + 2]! - px[b * 4 + 2]!;
        s += d0 * d0 + d1 * d1 + d2 * d2; cnt++;
      }
      if (cnt > 8 && s / cnt > best) return Infinity;
    }
    return cnt ? s / cnt : Infinity;
  };
  let front: number[] = [];
  const queued = new Uint8Array(n);
  const pushNb = (i: number, list: number[]): void => {
    const x = i % w;
    for (const q of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (q >= 0 && q < n && hole[q] && !filled[q] && !queued[q]) { queued[q] = 1; list.push(q); }
  };
  for (let i = 0; i < n; i++) if (filled[i]) pushNb(i, front);
  while (front.length) {
    const next: number[] = [];
    for (const p of front) {
      let best = Infinity, bi = -1;
      const x = p % w;
      // coherent candidates: continue a filled neighbour's source
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]] as const) {
        const nx = x + dx, ny = ((p / w) | 0) + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nb = ny * w + nx;
        if (!filled[nb] || srcOf[nb]! < 0) continue;
        const s = srcOf[nb]!, cx = (s % w) - dx, cy = ((s / w) | 0) - dy;
        if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
        const q = cy * w + cx;
        if (hole[q]) continue;
        const c = cost(p, q, best);
        if (c < best) { best = c; bi = q; }
      }
      for (let k = 0; k < candidates; k++) {
        const q = known[(rand() * known.length) | 0]!;
        const c = cost(p, q, best);
        if (c < best) { best = c; bi = q; }
      }
      if (bi < 0) bi = known[(rand() * known.length) | 0]!;
      px[p * 4] = px[bi * 4]!; px[p * 4 + 1] = px[bi * 4 + 1]!; px[p * 4 + 2] = px[bi * 4 + 2]!; px[p * 4 + 3] = px[bi * 4 + 3]!;
      srcOf[p] = bi;
      filled[p] = 1;
    }
    for (const p of front) pushNb(p, next);
    front = next;
  }
}

/** The shift (dx, dy) whose ring of pixels around the hole best matches the ring around the hole (proximity match). */
export function proximityOffset(px: Float32Array, w: number, h: number, mask: Float32Array, hb: Rect): [number, number] | null {
  const ring: number[] = [];
  for (let y = Math.max(0, hb.y - 3); y < Math.min(h, hb.y + hb.h + 3); y++) for (let x = Math.max(0, hb.x - 3); x < Math.min(w, hb.x + hb.w + 3); x++) {
    const i = y * w + x;
    if (mask[i]! > 0) continue;
    let near = false;
    for (let dy = -3; dy <= 3 && !near; dy++) for (let dx = -3; dx <= 3; dx++) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < w && Y < h && mask[Y * w + X]! > 0) { near = true; break; }
    }
    if (near) ring.push(i);
  }
  const ext = Math.max(hb.w, hb.h);
  let best = Infinity, out: [number, number] | null = null;
  for (const dist of [1.1, 1.5, 2]) for (let a = 0; a < 16; a++) {
    const dx = Math.round(Math.cos((a / 16) * Math.PI * 2) * ext * dist), dy = Math.round(Math.sin((a / 16) * Math.PI * 2) * ext * dist);
    // the whole shifted hole must land on known pixels inside the region
    if (hb.x + dx < 0 || hb.y + dy < 0 || hb.x + hb.w + dx > w || hb.y + hb.h + dy > h) continue;
    let ok = true;
    for (let y = hb.y; y < hb.y + hb.h && ok; y++) for (let x = hb.x; x < hb.x + hb.w; x++) if (mask[y * w + x]! > 0 && mask[(y + dy) * w + x + dx]! > 0) { ok = false; break; }
    if (!ok) continue;
    let s = 0, cnt = 0;
    for (const i of ring) {
      const x = (i % w) + dx, y = ((i / w) | 0) + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const j = y * w + x;
      for (let k = 0; k < 3; k++) { const d = px[i * 4 + k]! - px[j * 4 + k]!; s += d * d; }
      cnt++;
    }
    if (cnt && s / cnt < best) { best = s / cnt; out = [dx, dy]; }
  }
  return out;
}

/** Premultiplied mix of two straight RGBA buffers by a per-pixel weight, into `a`. */
export function mixPremul(a: Float32Array, b: Float32Array, m: Float32Array): Float32Array {
  for (let p = 0; p < m.length; p++) {
    const t = m[p]!;
    if (t <= 0) continue;
    const i = p * 4, aa = a[i + 3]!, ba = b[i + 3]!, oa = aa + (ba - aa) * t;
    if (oa <= 0) { a[i] = a[i + 1] = a[i + 2] = a[i + 3] = 0; continue; }
    for (let k = 0; k < 3; k++) a[i + k] = (a[i + k]! * aa + (b[i + k]! * ba - a[i + k]! * aa) * t) / oa;
    a[i + 3] = oa;
  }
  return a;
}

// ——— stroke coverage (spot healing, healing brush) ———

/** Sparse 0–1 coverage of a stroke in document tiles (max of the dabs). */
export class Coverage {
  tiles = new Map<number, Float32Array>();
  add(r: Rect, a: Float32Array): void {
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const v = a[y * r.w + x]!;
      if (v <= 0) continue;
      const X = r.x + x, Y = r.y + y, k = tileKey(X >> 8, Y >> 8);
      let t = this.tiles.get(k);
      if (!t) this.tiles.set(k, (t = new Float32Array(TILE * TILE)));
      const i = (Y & 255) * TILE + (X & 255);
      if (v > t[i]!) t[i] = v;
    }
  }
  bounds(): Rect | null {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [k, t] of this.tiles) {
      const tx = Math.floor(k / 65536) - 32768, ty = (k % 65536) - 32768;
      for (let i = 0; i < t.length; i++) if (t[i]! > 0) {
        const x = tx * TILE + (i & 255), y = ty * TILE + (i >> 8);
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    return x1 >= x0 ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : null;
  }
  read(r: Rect): Float32Array {
    const out = new Float32Array(r.w * r.h);
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const X = r.x + x, Y = r.y + y, t = this.tiles.get(tileKey(X >> 8, Y >> 8));
      if (t) out[y * r.w + x] = t[(Y & 255) * TILE + (X & 255)]!;
    }
    return out;
  }
}

const grow = (r: Rect, m: number, doc: ImageDocument): Rect => {
  const x0 = Math.max(0, Math.floor(r.x - m)), y0 = Math.max(0, Math.floor(r.y - m));
  return { x: x0, y: y0, w: Math.min(doc.width, Math.ceil(r.x + r.w + m)) - x0, h: Math.min(doc.height, Math.ceil(r.y + r.h + m)) - y0 };
};

const hooks = (ctx: ToolContext): PaintHooks => ctx.shared as PaintHooks;

// ——— spot healing brush ———

/** Heal a region of the active layer given its 0–1 mask (spot healing core; exported for scripts). */
export function spotHeal(ctx: ToolContext, surface: PaintSurface, region: Rect, mask: Float32Array, type: "proximity" | "texture" | "content-aware", sampleAll: boolean): void {
  const doc = ctx.doc, w = region.w, h = region.h, n = w * h;
  const cur = surface.readCurrent(region, new Float32Array(n * 4));
  const img = sampleAll ? readMerged(doc, region) : cur.slice();
  const hard = new Float32Array(n);
  let hx0 = w, hy0 = h, hx1 = -1, hy1 = -1;
  for (let i = 0; i < n; i++) if (mask[i]! > 0.02) { hard[i] = 1; const x = i % w, y = (i / w) | 0; if (x < hx0) hx0 = x; if (x > hx1) hx1 = x; if (y < hy0) hy0 = y; if (y > hy1) hy1 = y; }
  if (hx1 < 0) return;
  let result: Float32Array | null = null;
  if (type === "content-aware") result = hooks(ctx).fill?.contentAware?.({ doc, rect: region, pixels: img, mask: hard, width: w, height: h }) ?? null;
  if (!result) {
    const src = img.slice();
    const off = type === "proximity" ? proximityOffset(img, w, h, hard, { x: hx0, y: hy0, w: hx1 - hx0 + 1, h: hy1 - hy0 + 1 }) : null;
    if (off) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const sx = Math.max(0, Math.min(w - 1, x + off[0])), sy = Math.max(0, Math.min(h - 1, y + off[1]));
        const i = (y * w + x) * 4, j = (sy * w + sx) * 4;
        src[i] = img[j]!; src[i + 1] = img[j + 1]!; src[i + 2] = img[j + 2]!; src[i + 3] = img[j + 3]!;
      }
    } else synthesizeFill(src, w, h, hard, (region.x * 31 + region.y) | 0);
    result = healBlend(src, img, hard, w, h);
  }
  const out = mixPremul(cur.slice(), result, mask);
  surface.commit(region, out, cur);
  ctx.invalidate(region);
}

export const spotHealingTool: PaintTool = strokeTool({
  id: "spot-healing", group: "healing", label: "Spot Healing Brush", icon: "heal-spot", key: "J", step: "Spot Healing Brush", brush: "hard-round",
  options: [optSize(30), optHardness(100), choice("type", "Type", "content-aware", [["content-aware", "Content-Aware"], ["texture", "Create Texture"], ["proximity", "Proximity Match"]]), optSampleAll()],
  mask: false,
  setup(ctx, _p, st) {
    const cov = new Coverage();
    st.data.cov = cov;
    return { paint: false, mode: "normal", collect: (r, a) => cov.add(r, a) };
  },
  finish(ctx, st) {
    const cov = st.data.cov as Coverage, b = cov.bounds();
    if (!b || !st.surface) return;
    const region = grow(b, Math.max(b.w, b.h) * 1.2 + 8, ctx.doc);
    spotHeal(ctx, st.surface, region, cov.read(region), optStr(ctx, "type", "content-aware") as "proximity" | "texture" | "content-aware", optBool(ctx, "sampleAll", false));
  },
  overlay(ctx, st): OverlayShape[] {
    return st.stroke && st.points.length ? [{ type: "polyline", points: st.points, color: "rgba(0,0,0,0.45)", width: optNum(ctx, "size", 30) }] : [];
  },
});

// ——— healing brush ———

function patternOf(ctx: ToolContext): Pattern | null {
  const v = ctx.options.pattern;
  if (v && typeof v === "object") return v as Pattern;
  return findPattern(typeof v === "string" ? v : "checker", ctx.shared.patterns as Pattern[] | undefined);
}

export const healingBrushTool: PaintTool = strokeTool({
  id: "healing-brush", group: "healing", label: "Healing Brush", icon: "heal", key: "J", step: "Healing Brush", brush: "hard-round", cursor: "stamp",
  options: [
    optBrush("hard-round"), optSize(30), optHardness(100),
    optMode("normal", [["replace", "Replace"]]),
    choice("source", "Source", "sampled", [["sampled", "Sampled"], ["pattern", "Pattern"]]),
    { key: "pattern", label: "Pattern", kind: "pattern", default: "noise", visible: (o) => o.source === "pattern" },
    bool("aligned", "Aligned", true),
    choice("sample", "Sample", "current", [["current", "Current layer"], ["below", "Current & below"], ["all", "All layers"]]),
    { key: "diffusion", label: "Diffusion", kind: "number", min: 1, max: 7, step: 1, default: 5 },
    bool("showOverlay", "Show overlay", true), pct("overlayOpacity", "Overlay opacity", 50),
  ],
  mask: false,
  alt: (ctx, p) => setSource(ctx, "healSource", p),
  setup(ctx, p, st) {
    let read: PixelSource;
    let off: [number, number] = [0, 0];
    if (optStr(ctx, "source", "sampled") === "pattern") {
      const pat = patternOf(ctx);
      if (!pat) return "Choose a pattern";
      read = (r, out) => { renderPattern(pat, 1, r, out); return out; };
    } else {
      const o = sourceOffset(ctx, "healSource", p, optBool(ctx, "aligned", true));
      if (!o) return "Alt-click to set a source point first";
      off = o;
      read = sampleSource(ctx.doc, st.surface!.layer, optStr(ctx, "sample", "current") as "current" | "below" | "all");
    }
    const cov = new Coverage();
    st.data = { cov, read, offset: off };
    return { mode: "normal", opacity: 1, flow: 1, collect: (r, a) => cov.add(r, a), source: (r, out) => { read({ x: r.x + off[0], y: r.y + off[1], w: r.w, h: r.h }, out); } };
  },
  finish(ctx, st) {
    const cov = st.data.cov as Coverage, read = st.data.read as PixelSource, off = st.data.offset as [number, number];
    const b = cov.bounds(), s = st.surface;
    if (!b || !s) return;
    const region = grow(b, 2, ctx.doc), n = region.w * region.h;
    const dst = s.readOriginal(region, new Float32Array(n * 4));
    const src = read({ x: region.x + off[0], y: region.y + off[1], w: region.w, h: region.h }, new Float32Array(n * 4));
    const m = cov.read(region);
    const mode = optStr(ctx, "mode", "normal");
    let res: Float32Array;
    if (mode === "replace") res = src;
    else {
      res = healBlend(src, dst, m, region.w, region.h, 20 + optNum(ctx, "diffusion", 5) * 6);
      if (mode !== "normal") { const o = new Float32Array(n * 4); paintOver(dst, res, null, mode as PaintMode, 1, region, o); res = o; }
    }
    const out = mixPremul(dst.slice(), res, m);
    s.commit(region, out, dst);
    ctx.invalidate(region);
  },
  overlay: (ctx, st) => (optStr(ctx, "source", "sampled") === "sampled" ? sourceOverlay(ctx, "healSource", "healing-brush", (st.data.read as PixelSource | undefined) ?? null) : []),
});

// ——— patch tool and content-aware move: lasso without a selection, drag the selection with one ———

interface DragState { lasso: [number, number][] | null; from: [number, number] | null; to: [number, number] | null }
const dstates = new WeakMap<ToolContext, Map<string, DragState>>();
const dstate = (ctx: ToolContext, id: string): DragState => {
  let m = dstates.get(ctx);
  if (!m) dstates.set(ctx, (m = new Map()));
  let s = m.get(id);
  if (!s) m.set(id, (s = { lasso: null, from: null, to: null }));
  return s;
};

/** The selection's coverage over a region, shifted by (dx, dy) (the mask as it would be after moving). */
function selCoverage(sel: Mask, r: Rect, dx = 0, dy = 0): Float32Array {
  const out = new Float32Array(r.w * r.h);
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) out[y * r.w + x] = sel.get(r.x + x - dx, r.y + y - dy) / 255;
  return out;
}

function dragTool(id: string, label: string, icon: string, options: PaintTool["options"], apply: (ctx: ToolContext, layer: Layer, sel: Mask, dx: number, dy: number) => void): PaintTool {
  return {
    id, group: "healing", label, icon, key: "J", options,
    cursor: (ctx, p) => (p && ctx.doc.selection && ctx.doc.selection.get(Math.floor(p.x), Math.floor(p.y)) >= 128 ? "move" : "lasso"),
    down(ctx, p) {
      const st = dstate(ctx, id), sel = ctx.doc.selection;
      if (sel && sel.get(Math.floor(p.x), Math.floor(p.y)) >= 128) { st.from = [p.x, p.y]; st.to = [p.x, p.y]; st.lasso = null; }
      else { st.lasso = [[p.x, p.y]]; st.from = null; }
    },
    move(ctx, p) {
      const st = dstate(ctx, id);
      if (st.lasso) st.lasso.push([p.x, p.y]);
      else if (st.from) st.to = [p.x, p.y];
      ctx.invalidate(null);
    },
    up(ctx, p) {
      const st = dstate(ctx, id), doc = ctx.doc;
      if (st.lasso) {
        const pts = st.lasso;
        st.lasso = null;
        if (pts.length >= 3) doc.change("Lasso", () => combine(doc, polygonMask(doc, pts), "new"), "lasso");
        ctx.invalidate(null);
        return;
      }
      if (!st.from) return;
      const dx = Math.round(p.x - st.from[0]), dy = Math.round(p.y - st.from[1]);
      st.from = st.to = null;
      const layer = doc.active, sel = doc.selection;
      if (!sel || (!dx && !dy)) return;
      const why = paintBlocker(doc, layer, "layer");
      if (why) { ctx.announce(why); return; }
      doc.change(label, () => apply(ctx, layer!, sel, dx, dy), id);
      ctx.invalidate(null);
    },
    cancel(ctx) { const st = dstate(ctx, id); st.lasso = null; st.from = st.to = null; },
    overlay(ctx): OverlayShape[] {
      const st = dstate(ctx, id), b = ctx.doc.selection?.bounds();
      if (st.lasso) return [{ type: "polyline", points: st.lasso, dash: true }];
      if (st.from && st.to && b) return [{ type: "rect", rect: { ...b, x: b.x + st.to[0] - st.from[0], y: b.y + st.to[1] - st.from[1] }, dash: true }];
      return [];
    },
  };
}

/** Patch: replace the target region with the other one's texture, healed into the target's colors. */
export function patchRegion(doc: ImageDocument, layer: Layer, sel: Mask, dx: number, dy: number, o: { mode: "source" | "destination"; transparent: boolean; diffusion: number }): void {
  const sb = sel.bounds();
  if (!sb) return;
  const s = new PaintSurface(doc, layer, "layer");
  // source mode: the selection takes the pixels found at selection + d; destination: selection + d takes the selection's
  const tx = o.mode === "source" ? 0 : dx, ty = o.mode === "source" ? 0 : dy;
  const sx = o.mode === "source" ? dx : -dx, sy = o.mode === "source" ? dy : -dy;
  const region = grow({ x: sb.x + tx, y: sb.y + ty, w: sb.w, h: sb.h }, 2 + o.diffusion, doc), n = region.w * region.h;
  if (region.w <= 0 || region.h <= 0) return;
  const dst = s.readCurrent(region, new Float32Array(n * 4));
  const src = s.readCurrent({ x: region.x + sx, y: region.y + sy, w: region.w, h: region.h }, new Float32Array(n * 4));
  const m = selCoverage(sel, region, tx, ty);
  let res = healBlend(src, dst, m, region.w, region.h, 30 + o.diffusion * 5);
  if (o.transparent) { const half = new Float32Array(n).fill(0.5); res = mixPremul(dst.slice(), res, half); }
  const soft = m.slice();
  if (o.diffusion > 1) blurPlane(soft, region.w, region.h, o.diffusion / 2);
  for (let i = 0; i < n; i++) soft[i] = Math.min(m[i]! > 0 ? 1 : 0, soft[i]! * 1.5);
  const out = mixPremul(dst.slice(), res, soft);
  s.commit(region, out, dst, false);
}

export const patchTool: PaintTool = dragTool("patch", "Patch", "patch",
  [choice("patchMode", "Patch", "source", [["source", "Source"], ["destination", "Destination"]]), bool("transparent", "Transparent", false), { key: "diffusion", label: "Diffusion", kind: "number", min: 1, max: 7, step: 1, default: 5 }],
  (ctx, layer, sel, dx, dy) => patchRegion(ctx.doc, layer, sel, dx, dy, { mode: optStr(ctx, "patchMode", "source") as "source" | "destination", transparent: optBool(ctx, "transparent", false), diffusion: optNum(ctx, "diffusion", 5) }));

/** Content-aware move fallback: fill the hole (move mode) by synthesis, paste the selection at its new place healed in. */
export function moveAndHeal(doc: ImageDocument, layer: Layer, sel: Mask, dx: number, dy: number, mode: "move" | "extend", adaptation: number): void {
  const sb = sel.bounds();
  if (!sb) return;
  const s = new PaintSurface(doc, layer, "layer");
  const pr = grow({ x: sb.x + dx, y: sb.y + dy, w: sb.w, h: sb.h }, 3, doc), pn = pr.w * pr.h;
  // what moves: read before anything changes
  const moving = s.readCurrent({ x: pr.x - dx, y: pr.y - dy, w: pr.w, h: pr.h }, new Float32Array(pn * 4));
  if (mode === "move") {
    const hr = grow(sb, Math.max(sb.w, sb.h) * 0.75 + 8, doc), hn = hr.w * hr.h;
    const cur = s.readCurrent(hr, new Float32Array(hn * 4)), m = selCoverage(sel, hr);
    const filled = cur.slice(), hard = new Float32Array(hn);
    for (let i = 0; i < hn; i++) hard[i] = m[i]! > 0.02 ? 1 : 0;
    synthesizeFill(filled, hr.w, hr.h, hard, sb.x * 13 + sb.y);
    const healed = healBlend(filled, cur, hard, hr.w, hr.h);
    s.commit(hr, mixPremul(cur.slice(), healed, m), cur, false);
  }
  if (pr.w > 0 && pr.h > 0) {
    const dst = s.readCurrent(pr, new Float32Array(pn * 4)), m = selCoverage(sel, pr, dx, dy);
    // structure 1 (loose: heal strongly) … 7 (strict: keep the moved pixels)
    const healed = healBlend(moving, dst, m, pr.w, pr.h);
    const strict = Math.max(0, Math.min(1, (adaptation - 1) / 6));
    const res = mixPremul(healed, moving, new Float32Array(pn).fill(strict));
    s.commit(pr, mixPremul(dst.slice(), res, m), dst, false);
  }
  // the selection follows the moved content
  const moved = new Mask(sel.width, sel.height);
  for (let y = Math.max(0, sb.y + dy); y < Math.min(sel.height, sb.y + sb.h + dy); y++) for (let x = Math.max(0, sb.x + dx); x < Math.min(sel.width, sb.x + sb.w + dx); x++) moved.data[y * sel.width + x] = sel.get(x - dx, y - dy);
  doc.selection = moved.isEmpty() ? null : moved;
}

export const contentAwareMoveTool: PaintTool = dragTool("content-aware-move", "Content-Aware Move", "move-content-aware",
  [choice("moveMode", "Mode", "move", [["move", "Move"], ["extend", "Extend"]]), { key: "structure", label: "Structure", kind: "number", min: 1, max: 7, step: 1, default: 4 }, optSampleAll()],
  (ctx, layer, sel, dx, dy) => {
    const mode = optStr(ctx, "moveMode", "move") as "move" | "extend", adaptation = optNum(ctx, "structure", 4);
    if (hooks(ctx).fill?.contentAwareMove?.({ doc: ctx.doc, layer, dx, dy, mode, adaptation })) return;
    moveAndHeal(ctx.doc, layer, sel, dx, dy, mode, adaptation);
  });

// ——— red eye ———

/** Find the red pupil around (x, y) and neutralize it; returns the changed rectangle or null. */
export function redEye(doc: ImageDocument, layer: Layer, x: number, y: number, o: { pupilSize: number; darken: number; radius: number }): Rect | null {
  const s = new PaintSurface(doc, layer, "layer");
  const r = grow({ x: Math.floor(x), y: Math.floor(y), w: 1, h: 1 }, o.radius, doc), w = r.w, h = r.h, n = w * h;
  if (w <= 0 || h <= 0) return null;
  const px = s.readCurrent(r, new Float32Array(n * 4));
  const red = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const R = px[i * 4]!, G = px[i * 4 + 1]!, B = px[i * 4 + 2]!;
    // relative redness: a red pupil scores ~0.8, skin ~0.2
    red[i] = R > 0.2 ? (Math.max(0, R - Math.max(G, B)) / R) * px[i * 4 + 3]! : 0;
  }
  // the reddest pixel near the click seeds the pupil
  let seed = -1, best = 0.45;
  const cx = x - r.x, cy = y - r.y, near = o.radius * 0.75;
  for (let i = 0; i < n; i++) { const d = Math.hypot((i % w) - cx, ((i / w) | 0) - cy); if (d <= near && red[i]! > best) { best = red[i]!; seed = i; } }
  if (seed < 0) return null;
  const thr = Math.max(0.35, best * 0.5), comp = new Uint8Array(n), stack = [seed];
  comp[seed] = 1;
  let area = 0, mx = 0, my = 0;
  while (stack.length) {
    const i = stack.pop()!, xx = i % w;
    area++; mx += xx; my += (i / w) | 0;
    for (const q of [xx > 0 ? i - 1 : -1, xx < w - 1 ? i + 1 : -1, i - w, i + w]) if (q >= 0 && q < n && !comp[q] && red[q]! > thr) { comp[q] = 1; stack.push(q); }
  }
  mx /= area; my /= area;
  const pupil = Math.sqrt(area / Math.PI) * (0.6 + o.pupilSize * 0.8);
  const m = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const d = Math.hypot((i % w) - mx, ((i / w) | 0) - my);
    m[i] = comp[i] ? 1 : d <= pupil && red[i]! > 0.25 ? Math.min(1, (red[i]! - 0.25) * 4) : 0;
  }
  blurPlane(m, w, h, 1.5);
  const base = px.slice();
  for (let i = 0; i < n; i++) {
    const k = m[i]!;
    if (k <= 0) continue;
    const j = i * 4, G = px[j + 1]!, B = px[j + 2]!;
    const nr = Math.min(px[j]!, (G + B) / 2), dk = 1 - o.darken * 0.7;
    const t: RGBA = [nr * dk, G * dk, B * dk, 1];
    for (let c = 0; c < 3; c++) px[j + c] = px[j + c]! + (t[c]! - px[j + c]!) * k;
  }
  s.commit(r, px, base);
  return r;
}

export const redEyeTool: PaintTool = {
  id: "red-eye", group: "healing", label: "Red Eye", icon: "red-eye", key: "J",
  options: [pct("pupilSize", "Pupil size", 50), pct("darken", "Darken amount", 50)],
  cursor: () => "crosshair",
  down(ctx, p) {
    const doc = ctx.doc, layer = doc.active;
    const why = paintBlocker(doc, layer, "layer");
    if (why) { ctx.announce(why); return; }
    const radius = Math.max(16, Math.round(60 / (ctx.zoom || 1)));
    const r = doc.change("Red Eye", () => redEye(doc, layer!, p.x, p.y, { pupilSize: optPct(ctx, "pupilSize", 50), darken: optPct(ctx, "darken", 50), radius }), "red-eye");
    if (r) ctx.invalidate(r); else ctx.announce("No red eye found here");
  },
};
