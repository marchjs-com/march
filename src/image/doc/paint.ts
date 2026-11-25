// Paints: solid colors, gradients (linear, radial, angle, reflected, diamond; color and opacity stops, smoothness,
// dither, perceptual / linear / classic interpolation) and patterns, rendered into a region of straight float RGBA.

import type { Gradient, Paint, Pattern, RGBA } from "./layers.ts";
import type { Rect } from "./tiles.ts";
import { hash01 } from "./blend.ts";
import { linToOklab, oklabToLin } from "../color.ts";
import { toLinear, toEncoded } from "../raster.ts";

const lab = [0, 0, 0], lin = [0, 0, 0];
/** sRGB (encoded) → OKLab, through the engine's color maths (march/image). */
export function oklab(r: number, g: number, b: number): [number, number, number] {
  linToOklab(toLinear(r), toLinear(g), toLinear(b), lab);
  return [lab[0]!, lab[1]!, lab[2]!];
}
/** OKLab → sRGB (encoded, clamped). */
export function fromOklab(L: number, a: number, b: number): [number, number, number] {
  oklabToLin(L, a, b, lin);
  const c = (v: number): number => Math.max(0, Math.min(1, toEncoded(Math.max(0, v))));
  return [c(lin[0]!), c(lin[1]!), c(lin[2]!)];
}
const toLin = toLinear, toSrgb = toEncoded;

/** A 1024-entry lookup of a gradient's colors (straight RGBA). */
export function gradientLut(g: Gradient, n = 1024): Float32Array {
  const lut = new Float32Array(n * 4);
  const stops = [...g.stops].sort((a, b) => a.at - b.at);
  const alpha = g.alpha && g.alpha.length ? [...g.alpha].sort((a, b) => a.at - b.at) : null;
  const method = g.method ?? "perceptual";
  const smooth = g.smoothness ?? 1;
  const ease = (t: number): number => (smooth <= 0 ? t : t + (t * t * (3 - 2 * t) - t) * smooth * 0.5);
  const at = (t: number): RGBA => {
    if (!stops.length) return [0, 0, 0, 0];
    if (t <= stops[0]!.at) return [...stops[0]!.color] as RGBA;
    const last = stops[stops.length - 1]!;
    if (t >= last.at) return [...last.color] as RGBA;
    let i = 0;
    while (i < stops.length - 1 && stops[i + 1]!.at < t) i++;
    const a = stops[i]!, b = stops[i + 1]!;
    const u = ease((t - a.at) / Math.max(1e-6, b.at - a.at));
    if (method === "perceptual") {
      const la = oklab(a.color[0]!, a.color[1]!, a.color[2]!), lb = oklab(b.color[0]!, b.color[1]!, b.color[2]!);
      const c = fromOklab(la[0]! + (lb[0]! - la[0]!) * u, la[1]! + (lb[1]! - la[1]!) * u, la[2]! + (lb[2]! - la[2]!) * u);
      return [c[0]!, c[1]!, c[2]!, a.color[3]! + (b.color[3]! - a.color[3]!) * u];
    }
    if (method === "linear") {
      const m = (x: number, y: number): number => toSrgb(toLin(x) + (toLin(y) - toLin(x)) * u);
      return [m(a.color[0]!, b.color[0]!), m(a.color[1]!, b.color[1]!), m(a.color[2]!, b.color[2]!), a.color[3]! + (b.color[3]! - a.color[3]!) * u];
    }
    return [0, 1, 2, 3].map((k) => a.color[k]! + (b.color[k]! - a.color[k]!) * u) as RGBA;
  };
  const alphaAt = (t: number): number => {
    if (!alpha) return 1;
    if (t <= alpha[0]!.at) return alpha[0]!.value;
    if (t >= alpha[alpha.length - 1]!.at) return alpha[alpha.length - 1]!.value;
    let i = 0;
    while (i < alpha.length - 1 && alpha[i + 1]!.at < t) i++;
    const u = (t - alpha[i]!.at) / Math.max(1e-6, alpha[i + 1]!.at - alpha[i]!.at);
    return alpha[i]!.value + (alpha[i + 1]!.value - alpha[i]!.value) * u;
  };
  for (let i = 0; i < n; i++) {
    let t = i / (n - 1);
    if (g.reverse) t = 1 - t;
    const c = at(t);
    lut.set([c[0]!, c[1]!, c[2]!, c[3]! * alphaAt(t)], i * 4);
  }
  return lut;
}

/** The 0–1 position along a gradient for a point. */
export function gradientT(type: Gradient["type"], x: number, y: number, fx: number, fy: number, tx: number, ty: number): number {
  const dx = tx - fx, dy = ty - fy, len2 = dx * dx + dy * dy || 1, len = Math.sqrt(len2);
  const px = x - fx, py = y - fy;
  switch (type) {
    case "linear": return (px * dx + py * dy) / len2;
    case "radial": return Math.hypot(px, py) / len;
    case "reflected": return Math.abs((px * dx + py * dy) / len2);
    case "angle": {
      let a = Math.atan2(py, px) - Math.atan2(dy, dx);
      a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      return 1 - a / (Math.PI * 2);
    }
    case "diamond": {
      const ux = dx / len, uy = dy / len;
      return (Math.abs(px * ux + py * uy) + Math.abs(-px * uy + py * ux)) / len;
    }
  }
}

export function renderGradient(g: Gradient, r: Rect, out: Float32Array, box?: Rect): void {
  const lut = gradientLut(g);
  const n = lut.length / 4 - 1;
  const b = box ?? r;
  const fx = g.relative ? b.x + g.from[0]! * b.w : g.from[0]!, fy = g.relative ? b.y + g.from[1]! * b.h : g.from[1]!;
  const tx = g.relative ? b.x + g.to[0]! * b.w : g.to[0]!, ty = g.relative ? b.y + g.to[1]! * b.h : g.to[1]!;
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      let t = gradientT(g.type, r.x + x + 0.5, r.y + y + 0.5, fx, fy, tx, ty);
      if (g.dither) t += (hash01(r.x + x, r.y + y, 7) - 0.5) / 255;
      const k = Math.round(Math.max(0, Math.min(1, t)) * n) * 4, o = (y * r.w + x) * 4;
      out[o] = lut[k]!; out[o + 1] = lut[k + 1]!; out[o + 2] = lut[k + 2]!; out[o + 3] = lut[k + 3]!;
    }
  }
}

export function renderPattern(p: Pattern, scale: number, r: Rect, out: Float32Array, angle = 0, offset: [number, number] = [0, 0]): void {
  const s = scale || 1, ca = Math.cos(-angle), sa = Math.sin(-angle);
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      let u = r.x + x - offset[0]!, v = r.y + y - offset[1]!;
      if (angle) { const ru = u * ca - v * sa, rv = u * sa + v * ca; u = ru; v = rv; }
      const px = ((Math.floor(u / s) % p.width) + p.width) % p.width, py = ((Math.floor(v / s) % p.height) + p.height) % p.height;
      const si = (py * p.width + px) * 4, o = (y * r.w + x) * 4;
      out[o] = p.pixels[si]!; out[o + 1] = p.pixels[si + 1]!; out[o + 2] = p.pixels[si + 2]!; out[o + 3] = p.pixels[si + 3]!;
    }
  }
}

/** A paint over a region (straight RGBA). `box` is the reference box for relative gradients. */
export function renderPaint(paint: Paint, r: Rect, out: Float32Array = new Float32Array(r.w * r.h * 4), box?: Rect): Float32Array {
  if (paint.type === "solid") {
    const c = paint.color;
    for (let i = 0; i < out.length; i += 4) { out[i] = c[0]!; out[i + 1] = c[1]!; out[i + 2] = c[2]!; out[i + 3] = c[3]!; }
  } else if (paint.type === "gradient") renderGradient(paint.gradient, r, out, box);
  else renderPattern(paint.pattern, paint.scale, r, out, paint.angle ?? 0, paint.offset);
  return out;
}

/** Built-in patterns (made here, procedurally: no third-party images). */
export function builtinPatterns(): Pattern[] {
  const make = (id: string, name: string, w: number, h: number, f: (x: number, y: number) => RGBA): Pattern => {
    const px = new Float32Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.set(f(x, y), (y * w + x) * 4);
    return { id, name, width: w, height: h, pixels: px };
  };
  return [
    make("checker", "Checker", 16, 16, (x, y) => ((x >> 3) ^ (y >> 3)) & 1 ? [0.8, 0.8, 0.8, 1] : [1, 1, 1, 1]),
    make("dots", "Dots", 12, 12, (x, y) => (Math.hypot(x - 6, y - 6) < 3 ? [0.2, 0.2, 0.25, 1] : [1, 1, 1, 1])),
    make("stripes", "Stripes", 12, 12, (x, y) => ((x + y) % 12 < 4 ? [0.25, 0.4, 0.95, 1] : [1, 1, 1, 1])),
    make("grid", "Grid", 16, 16, (x, y) => (x === 0 || y === 0 ? [0.6, 0.65, 0.75, 1] : [1, 1, 1, 1])),
    make("noise", "Noise", 64, 64, (x, y) => { const v = 0.6 + hash01(x, y, 3) * 0.4; return [v, v, v, 1]; }),
    make("waves", "Waves", 32, 16, (x, y) => (Math.abs(y - 8 - Math.sin((x / 32) * Math.PI * 2) * 4) < 1.5 ? [0.1, 0.6, 0.6, 1] : [1, 1, 1, 1])),
  ];
}
