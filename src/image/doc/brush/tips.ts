// Brush tips: the shape one dab stamps. A tip is round (analytic, hardness 0–100 % soft falloff), an image (8-bit alpha
// from any RGBA or an imported .abr sample) or procedural (generated here from a seed: spatter, grass, leaves, stars…;
// no third-party images). Tips are sampled at any size, angle, roundness and flip into a dab alpha plane; image tips
// keep a small mip pyramid so a big sample shrunk to a few pixels stays smooth. Specs are plain JSON (presets save them).

/** A tip as stored in a preset (JSON). @tr Fırça ucu tanımı. */
export type TipSpec =
  | { type: "round"; hardness: number }
  | { type: "image"; width: number; height: number; /** base64 of width×height 8-bit alpha (255 = full paint) */ data: string; name?: string | undefined }
  | { type: "procedural"; gen: ProceduralTip; seed?: number | undefined; res?: number | undefined };

export type ProceduralTip =
  | "spatter" | "grass" | "leaf" | "star" | "cloud" | "hair" | "rake" | "chalk" | "charcoal" | "dry" | "noise"
  | "square" | "ink" | "sponge" | "smudge-stick" | "pastel";

/** A decoded tip: alpha 0–1, row-major, with mips (each half the size, box filtered). */
export interface TipShape {
  width: number;
  height: number;
  alpha: Float32Array;
  mips: { width: number; height: number; alpha: Float32Array }[];
}

// ——— base64 (no DOM: runs in workers and Node) ———

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_INV = new Int16Array(128).fill(-1);
for (let i = 0; i < 64; i++) B64_INV[B64.charCodeAt(i)] = i;

export function bytesToBase64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i]! << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    s += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (i + 1 < b.length ? B64[(n >> 6) & 63]! : "=") + (i + 2 < b.length ? B64[n & 63]! : "=");
  }
  return s;
}

export function base64ToBytes(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array((clean.length * 3) >> 2);
  let o = 0, acc = 0, bits = 0;
  for (let i = 0; i < clean.length; i++) {
    acc = (acc << 6) | B64_INV[clean.charCodeAt(i)]!;
    bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 255; }
  }
  return out.subarray(0, o);
}

// ——— building tips ———

/** A tip from 0–1 alpha values. */
export function tipFromAlpha(width: number, height: number, alpha: Float32Array): TipShape {
  const mips: TipShape["mips"] = [];
  let w = width, h = height, a = alpha;
  while (w > 2 && h > 2 && mips.length < 8) {
    const nw = w >> 1, nh = h >> 1, n = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const i = y * 2 * w + x * 2;
      n[y * nw + x] = (a[i]! + a[i + 1]! + a[i + w]! + a[i + w + 1]!) * 0.25;
    }
    mips.push({ width: nw, height: nh, alpha: n });
    w = nw; h = nh; a = n;
  }
  return { width, height, alpha, mips };
}

/**
 * An image tip from straight RGBA (0–1 floats or 0–255 bytes). Dark, opaque pixels paint (the classic "define brush
 * preset" rule); `useAlpha` takes the alpha channel alone instead.
 */
export function tipFromRGBA(width: number, height: number, px: ArrayLike<number>, useAlpha = false): TipSpec {
  const max = px instanceof Uint8Array || px instanceof Uint8ClampedArray ? 255 : 1;
  const b = new Uint8Array(width * height);
  for (let i = 0; i < b.length; i++) {
    const r = px[i * 4]! / max, g = px[i * 4 + 1]! / max, bl = px[i * 4 + 2]! / max, a = px[i * 4 + 3]! / max;
    const v = useAlpha ? a : (1 - (0.299 * r + 0.587 * g + 0.114 * bl)) * a;
    b[i] = Math.round(Math.max(0, Math.min(1, v)) * 255);
  }
  return { type: "image", width, height, data: bytesToBase64(b) };
}

/** Seeded PRNG (mulberry32): deterministic tips and dynamics. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth01 = (e0: number, e1: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const valueNoise = (x: number, y: number, seed: number): number => {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const h = (a: number, b: number): number => { let n = (a * 374761393 + b * 668265263 + seed * 1442695041) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
};
const fbm = (x: number, y: number, seed: number): number => (valueNoise(x, y, seed) * 0.5 + valueNoise(x * 2, y * 2, seed + 1) * 0.3 + valueNoise(x * 4, y * 4, seed + 2) * 0.2);

/** Distance from point to segment. */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** Render f(u, v) over [-1, 1]² with 2×2 supersampling. */
function render(res: number, f: (u: number, v: number) => number): Float32Array {
  const a = new Float32Array(res * res), k = 2 / res;
  for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
    let s = 0;
    for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) s += f(-1 + (x + 0.25 + sx * 0.5) * k, -1 + (y + 0.25 + sy * 0.5) * k);
    a[y * res + x] = Math.max(0, Math.min(1, s * 0.25));
  }
  return a;
}

/** Generate a procedural tip's alpha (deterministic for a seed). */
export function proceduralAlpha(gen: ProceduralTip, seed = 1, res = 96): Float32Array {
  const r = rng(seed * 7919 + gen.length);
  switch (gen) {
    case "spatter": {
      const dots = Array.from({ length: 40 }, () => { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.85; return [Math.cos(a) * d, Math.sin(a) * d, 0.03 + r() * r() * 0.16] as const; });
      return render(res, (u, v) => { let m = 0; for (const [x, y, rad] of dots) m = Math.max(m, smooth01(rad, rad * 0.7, Math.hypot(u - x, v - y))); return m; });
    }
    case "grass": {
      const blades = Array.from({ length: 9 }, () => [(r() - 0.5) * 1.2, (r() - 0.5) * 0.9, 0.9 + r() * 0.9, 0.05 + r() * 0.04] as const);
      return render(res, (u, v) => {
        let m = 0;
        for (const [bx, bend, len, wid] of blades) {
          const t = (0.95 - v) / len; // 0 at the root (bottom), 1 at the tip
          if (t < 0 || t > 1) continue;
          const cx = bx + bend * t * t, w = wid * (1 - t);
          m = Math.max(m, smooth01(w + 0.01, w * 0.5, Math.abs(u - cx)));
        }
        return m;
      });
    }
    case "leaf":
      return render(res, (u, v) => {
        const w = 0.5 * Math.pow(Math.max(0, 1 - v * v), 0.8); // pointed ends
        const edge = smooth01(w + 0.02, w - 0.02, Math.abs(u));
        const vein = 1 - 0.6 * smooth01(0.03, 0.01, Math.abs(u)) * (v < 0.9 ? 1 : 0);
        return edge * vein;
      });
    case "star":
      return render(res, (u, v) => {
        const a = Math.atan2(v, u) + Math.PI / 2, d = Math.hypot(u, v), n = 5;
        const k = Math.cos(Math.PI / n) / Math.cos(((((a % (2 * Math.PI / n)) + 2 * Math.PI / n) % (2 * Math.PI / n)) - Math.PI / n));
        const rr = 0.95 * (0.42 + 0.58 * Math.pow(Math.max(0, (k - Math.cos(Math.PI / n)) / (1 - Math.cos(Math.PI / n))), 2.2));
        return smooth01(rr + 0.02, rr - 0.02, d);
      });
    case "cloud": {
      const blobs = Array.from({ length: 14 }, () => [(r() - 0.5) * 1.1, (r() - 0.5) * 0.7, 0.25 + r() * 0.3] as const);
      return render(res, (u, v) => { let s = 0; for (const [x, y, rad] of blobs) s += Math.exp(-((u - x) ** 2 + (v - y) ** 2) / (rad * rad)); return smooth01(0.4, 1.4, s) * (0.75 + 0.25 * fbm(u * 3, v * 3, seed)); });
    }
    case "hair": {
      const strands = Array.from({ length: 22 }, () => [(r() - 0.5) * 1.6, (r() - 0.5) * 0.8, 0.012 + r() * 0.012] as const);
      return render(res, (u, v) => { let m = 0; for (const [x, c, w] of strands) m = Math.max(m, smooth01(w * 2, w * 0.5, Math.abs(u - x - c * v * v))); return m * smooth01(1, 0.6, Math.abs(v)); });
    }
    case "rake": {
      const n = 7;
      return render(res, (u, v) => { let m = 0; for (let i = 0; i < n; i++) { const x = -0.85 + (1.7 * i) / (n - 1); m = Math.max(m, smooth01(0.13, 0.08, Math.hypot(u - x, v * 1.3))); } return m; });
    }
    case "chalk":
      return render(res, (u, v) => { const d = Math.hypot(u, v); return smooth01(1, 0.75, d) * smooth01(0.35, 0.65, fbm(u * 9, v * 9, seed)); });
    case "charcoal":
      return render(res, (u, v) => { const d = Math.hypot(u * 0.7, v * 1.4); return smooth01(1, 0.6, d) * smooth01(0.3, 0.7, fbm(u * 3, v * 22, seed)); });
    case "dry": {
      const bristles = Array.from({ length: 26 }, () => [(r() - 0.5) * 1.8, 0.015 + r() * 0.035, 0.4 + r() * 0.6] as const);
      return render(res, (u, v) => { let m = 0; for (const [x, w, a] of bristles) m = Math.max(m, a * smooth01(w * 1.6, w * 0.6, Math.abs(u - x))); return m * smooth01(0.75, 0.45, Math.abs(v)); });
    }
    case "noise":
      return render(res, (u, v) => smooth01(1, 0.85, Math.hypot(u, v)) * (valueNoise((u + 1) * 40, (v + 1) * 40, seed) > 0.55 ? 1 : 0.15));
    case "square":
      return render(res, (u, v) => (Math.abs(u) <= 0.95 && Math.abs(v) <= 0.95 ? 1 : 0));
    case "ink":
      return render(res, (u, v) => { const a = Math.atan2(v, u), d = Math.hypot(u, v), rr = 0.72 + 0.18 * fbm(Math.cos(a) * 2 + 3, Math.sin(a) * 2 + 3, seed); return smooth01(rr + 0.03, rr - 0.03, d); });
    case "sponge":
      return render(res, (u, v) => smooth01(1, 0.8, Math.hypot(u, v)) * smooth01(0.42, 0.55, fbm(u * 6 + 10, v * 6 + 10, seed)));
    case "smudge-stick":
      return render(res, (u, v) => { const d = Math.hypot(u * 0.8, v * 2.2); return smooth01(1, 0.5, d) * (0.6 + 0.4 * fbm(u * 2, v * 16, seed)); });
    case "pastel":
      return render(res, (u, v) => { const d = Math.max(Math.abs(u) * 0.9, Math.abs(v) * 1.6); return smooth01(1, 0.8, d) * smooth01(0.25, 0.6, fbm(u * 14, v * 14, seed)); });
  }
}

const cache = new Map<string, TipShape | null>();

/** The decoded shape of a tip spec (null = round: computed analytically per dab). Cached. */
export function tipShape(spec: TipSpec): TipShape | null {
  if (spec.type === "round") return null;
  const key = spec.type === "image" ? `i:${spec.width}x${spec.height}:${spec.data.length}:${spec.data.slice(0, 64)}:${spec.data.slice(-64)}` : `p:${spec.gen}:${spec.seed ?? 1}:${spec.res ?? 96}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let shape: TipShape;
  if (spec.type === "image") {
    const b = base64ToBytes(spec.data), a = new Float32Array(spec.width * spec.height);
    for (let i = 0; i < a.length; i++) a[i] = (b[i] ?? 0) / 255;
    shape = tipFromAlpha(spec.width, spec.height, a);
  } else {
    const res = spec.res ?? 96;
    shape = tipFromAlpha(res, res, proceduralAlpha(spec.gen, spec.seed ?? 1, res));
  }
  if (cache.size > 256) cache.clear();
  cache.set(key, shape);
  return shape;
}

// ——— sampling a dab ———

/** How one dab is placed. */
export interface DabGeometry {
  /** Center in document pixels (sub-pixel). */
  x: number;
  y: number;
  /** Diameter in pixels (the larger side of an image tip). */
  size: number;
  /** Radians. */
  angle: number;
  /** 0–1 (1 = round). */
  roundness: number;
  flipX: boolean;
  flipY: boolean;
}

/** The pixel rectangle a dab can touch. */
export function dabRect(g: DabGeometry, shape: TipShape | null): { x: number; y: number; w: number; h: number } {
  let rad = g.size / 2;
  if (shape) rad *= Math.hypot(1, Math.min(shape.width, shape.height) / Math.max(shape.width, shape.height));
  const x0 = Math.floor(g.x - rad - 1), y0 = Math.floor(g.y - rad - 1);
  return { x: x0, y: y0, w: Math.ceil(g.x + rad + 1) - x0 + 1, h: Math.ceil(g.y + rad + 1) - y0 + 1 };
}

/**
 * The round tip's alpha at a normalized distance d (0 center, 1 edge). Hardness 0 is a cosine falloff over the whole
 * radius; hardness h keeps the inner h of the radius solid and falls off over the rest; hardness 1 is a hard disk
 * anti-aliased over one pixel (`radiusPx`).
 */
export function roundFalloff(d: number, hardness: number, radiusPx: number): number {
  const rim = Math.max(0, Math.min(1, (1 - d) * radiusPx + 0.5));
  if (hardness >= 0.999 || d <= hardness) return rim;
  if (d >= 1) return 0;
  const t = (d - hardness) / (1 - hardness);
  return Math.min(rim, 0.5 * (1 + Math.cos(Math.PI * t)));
}

const LUT_N = 1024;
const lutCache = new Map<string, Float32Array>();
/** roundFalloff sampled over d ∈ [0, 1 + 1/radius] (one extra entry for interpolation). */
function falloffLut(hardness: number, radiusPx: number): Float32Array {
  const key = `${Math.round(hardness * 1000)}:${Math.round(radiusPx * 4)}`;
  let l = lutCache.get(key);
  if (!l) {
    const lim = 1 + 1 / Math.max(0.5, radiusPx);
    l = new Float32Array(LUT_N + 1);
    for (let i = 0; i <= LUT_N; i++) l[i] = roundFalloff((i / (LUT_N - 1)) * lim, hardness, radiusPx);
    if (lutCache.size > 512) lutCache.clear();
    lutCache.set(key, l);
  }
  return l;
}

export interface DabFlags {
  hardness: number;
  /** Pencil: no anti-aliasing (alpha is 0 or 1). */
  aliased?: boolean | undefined;
  /** Wet edges: paint pools at the rim. */
  wetEdges?: boolean | undefined;
}

/**
 * Rasterize one dab into `out` (row-major over `r`): alpha 0–1. Round tips are analytic; image / procedural tips are
 * sampled bilinearly from the mip level nearest their on-canvas scale, rotated, squashed by roundness and flipped.
 */
export function rasterDab(g: DabGeometry, shape: TipShape | null, f: DabFlags, r: { x: number; y: number; w: number; h: number }, out: Float32Array): void {
  const ca = Math.cos(-g.angle), sa = Math.sin(-g.angle);
  const round = Math.max(0.01, g.roundness);
  const fx = g.flipX ? -1 : 1, fy = g.flipY ? -1 : 1;
  const n = r.w * r.h;
  if (!shape) {
    const rad = Math.max(0.5, g.size / 2), inv = 1 / rad, h = f.aliased ? 1 : f.hardness;
    // tiny dabs: scale alpha by area so a 0.5 px brush does not paint as a full pixel
    const areaK = g.size < 1 ? g.size : 1;
    const lut = f.aliased ? null : falloffLut(h, rad * round);
    const lim = 1 + 1 / Math.max(0.5, rad * round), lk = (LUT_N - 1) / lim;
    for (let y = 0, i = 0; y < r.h; y++) {
      const dy = r.y + y + 0.5 - g.y;
      for (let x = 0; x < r.w; x++, i++) {
        const dx = r.x + x + 0.5 - g.x;
        const u = dx * ca - dy * sa, v = (dx * sa + dy * ca) / round;
        const d = Math.sqrt(u * u + v * v) * inv;
        if (d >= lim) { out[i] = 0; continue; }
        let a: number;
        if (!lut) a = d <= 1 ? 1 : 0;
        else { const t = d * lk, k = t | 0, fr = t - k; a = lut[k]! + (lut[k + 1]! - lut[k]!) * fr; }
        if (f.wetEdges && a > 0) a *= 0.45 + 0.55 * Math.min(1, d * d * d * d);
        out[i] = a * areaK;
      }
    }
    if (f.aliased && n > 0) { let any = false; for (let i = 0; i < n; i++) if (out[i]! > 0) { any = true; break; } if (!any) out[((r.h >> 1) * r.w + (r.w >> 1))] = 1; }
    return;
  }
  // image tip: pick the mip whose scale is ≥ 1/2 of the on-canvas pixel
  const side = Math.max(shape.width, shape.height);
  const scale = g.size / side; // canvas pixels per tip pixel (level 0)
  let lvl = { width: shape.width, height: shape.height, alpha: shape.alpha }, k = 1;
  for (const m of shape.mips) { if (scale * k * 2 > 1) break; lvl = m; k *= 2; }
  const tw = lvl.width, th = lvl.height, ta = lvl.alpha;
  const s = 1 / (scale * k); // tip-level pixels per canvas pixel
  const cx = tw / 2, cy = th / 2;
  for (let y = 0, i = 0; y < r.h; y++) {
    const dy = r.y + y + 0.5 - g.y;
    for (let x = 0; x < r.w; x++, i++) {
      const dx = r.x + x + 0.5 - g.x;
      const u = (dx * ca - dy * sa) * fx * s + cx - 0.5, v = ((dx * sa + dy * ca) / round) * fy * s + cy - 0.5;
      if (u <= -1 || v <= -1 || u >= tw || v >= th) { out[i] = 0; continue; }
      const x0 = Math.floor(u), y0 = Math.floor(v), ax = u - x0, ay = v - y0;
      const p00 = x0 >= 0 && y0 >= 0 ? ta[y0 * tw + x0]! : 0;
      const p10 = x0 + 1 < tw && y0 >= 0 ? ta[y0 * tw + x0 + 1]! : 0;
      const p01 = x0 >= 0 && y0 + 1 < th ? ta[(y0 + 1) * tw + x0]! : 0;
      const p11 = x0 + 1 < tw && y0 + 1 < th ? ta[(y0 + 1) * tw + x0 + 1]! : 0;
      let a = (p00 * (1 - ax) + p10 * ax) * (1 - ay) + (p01 * (1 - ax) + p11 * ax) * ay;
      if (f.aliased) a = a >= 0.5 ? 1 : 0;
      else if (f.wetEdges && a > 0) a *= Math.min(1, 0.45 + 1.1 * (1 - a));
      out[i] = a;
    }
  }
}
