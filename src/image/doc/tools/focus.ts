// Focus family: blur and sharpen (strength, mode, sample all layers; the filter comes from ctx.shared.filters, the
// march/image engine) and smudge (strength, sample all layers, finger painting: carries color along the stroke).

import { blendColor, type BlendMode } from "../blend.ts";
import type { Rect } from "../tiles.ts";
import { bool, optBool, optBrush, optHardness, optPct, optSampleAll, optSize, optSmoothing, optStr, pct, readMerged, strokeTool, type PaintHooks, type PaintTool } from "./paint-common.ts";
import type { ToolContext } from "./tool.ts";

const focusModes: [string, string][] = [["normal", "Normal"], ["darken", "Darken"], ["lighten", "Lighten"], ["hue", "Hue"], ["saturation", "Saturation"], ["color", "Color"], ["luminosity", "Luminosity"]];
const modeOpt = { key: "mode", label: "Mode", kind: "choice" as const, default: "normal", options: focusModes.map(([value, label]) => ({ value, label })) };

// fallback until march/image lands: a 3×3 box average of straight RGBA (edges clamp)
function box3(src: Float32Array, w: number, h: number, out: Float32Array): Float32Array {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = Math.max(0, Math.min(h - 1, y + dy));
      for (let dx = -1; dx <= 1; dx++) {
        const xx = Math.max(0, Math.min(w - 1, x + dx)), i = (yy * w + xx) * 4, al = src[i + 3]!;
        r += src[i]! * al; g += src[i + 1]! * al; b += src[i + 2]! * al; a += al; n++;
      }
    }
    const o = (y * w + x) * 4;
    if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; } else { out[o] = src[o]!; out[o + 1] = src[o + 1]!; out[o + 2] = src[o + 2]!; }
    out[o + 3] = a / n;
  }
  return out;
}

/** Mix `px` toward `target` by a·strength, through a blend mode (normal mixes directly). */
function applyMode(mode: BlendMode, px: Float32Array, target: Float32Array, a: Float32Array, strength: number, alphaToo: boolean): void {
  const b = [0, 0, 0], s = [0, 0, 0];
  for (let p = 0; p < a.length; p++) {
    const k = a[p]! * strength;
    if (k <= 0) continue;
    const i = p * 4;
    let tr = target[i]!, tg = target[i + 1]!, tb = target[i + 2]!;
    if (mode !== "normal") {
      b[0] = px[i]!; b[1] = px[i + 1]!; b[2] = px[i + 2]!; s[0] = tr; s[1] = tg; s[2] = tb;
      const c = blendColor(mode, b, s);
      tr = c[0]!; tg = c[1]!; tb = c[2]!;
    }
    px[i] = px[i]! + (tr - px[i]!) * k; px[i + 1] = px[i + 1]! + (tg - px[i + 1]!) * k; px[i + 2] = px[i + 2]! + (tb - px[i + 2]!) * k;
    if (alphaToo) px[i + 3] = px[i + 3]! + (target[i + 3]! - px[i + 3]!) * k;
  }
}

/** The pixels a focus dab reads: the layer's (already in px) or all layers merged. */
const readFor = (ctx: ToolContext, r: Rect, px: Float32Array): Float32Array => (optBool(ctx, "sampleAll", false) ? readMerged(ctx.doc, r) : px);

export const blurTool: PaintTool = strokeTool({
  id: "blur", group: "focus", label: "Blur", icon: "blur", key: "R", step: "Blur", brush: "soft-round",
  options: [optBrush("soft-round"), optSize(60), optHardness(0), modeOpt, pct("strength", "Strength", 50), optSampleAll(), ...optSmoothing()],
  setup(ctx) {
    const strength = optPct(ctx, "strength", 50), mode = optStr(ctx, "mode", "normal") as BlendMode, f = (ctx.shared as PaintHooks).filters?.blur;
    let tmp = new Float32Array(0);
    return {
      mode: "normal",
      direct(r, px, a) {
        const src = readFor(ctx, r, px);
        let blurred: Float32Array;
        if (f) blurred = f({ width: r.w, height: r.h, data: src.slice() }, 2);
        else { if (tmp.length < src.length) tmp = new Float32Array(src.length); blurred = box3(src, r.w, r.h, tmp); }
        applyMode(mode, px, blurred, a, strength, !optBool(ctx, "sampleAll", false));
      },
    };
  },
});

export const sharpenTool: PaintTool = strokeTool({
  id: "sharpen", group: "focus", label: "Sharpen", icon: "sharpen", key: "R", step: "Sharpen", brush: "soft-round",
  options: [optBrush("soft-round"), optSize(60), optHardness(0), modeOpt, pct("strength", "Strength", 50), optSampleAll(), bool("protectDetail", "Protect detail", true), ...optSmoothing()],
  setup(ctx) {
    const strength = optPct(ctx, "strength", 50), mode = optStr(ctx, "mode", "normal") as BlendMode, f = (ctx.shared as PaintHooks).filters?.sharpen;
    const protect = optBool(ctx, "protectDetail", true);
    let tmp = new Float32Array(0), sharp = new Float32Array(0);
    return {
      mode: "normal",
      direct(r, px, a) {
        const src = readFor(ctx, r, px);
        let out: Float32Array;
        if (f) out = f({ width: r.w, height: r.h, data: src.slice() }, protect ? 0.5 : 1);
        else {
          // fallback until march/image lands: unsharp mask against the 3×3 box average
          if (tmp.length < src.length) { tmp = new Float32Array(src.length); sharp = new Float32Array(src.length); }
          const bl = box3(src, r.w, r.h, tmp), k = protect ? 0.6 : 1.2;
          for (let i = 0; i < src.length; i += 4) {
            for (let c = 0; c < 3; c++) {
              let d = (src[i + c]! - bl[i + c]!) * k;
              if (protect) d = Math.max(-0.15, Math.min(0.15, d)); // no halos or clipped noise
              sharp[i + c] = Math.max(0, Math.min(1, src[i + c]! + d));
            }
            sharp[i + 3] = src[i + 3]!;
          }
          out = sharp;
        }
        applyMode(mode, px, out, a, strength, false);
      },
    };
  },
});

export const smudgeTool: PaintTool = strokeTool({
  id: "smudge", group: "focus", label: "Smudge", icon: "smudge", key: "R", step: "Smudge", brush: "soft-round",
  options: [optBrush("soft-round"), optSize(40), optHardness(0), modeOpt, pct("strength", "Strength", 50), optSampleAll(), bool("fingerPainting", "Finger painting", false), ...optSmoothing()],
  setup(ctx) {
    const strength = optPct(ctx, "strength", 50), mode = optStr(ctx, "mode", "normal") as BlendMode, finger = optBool(ctx, "fingerPainting", false);
    // the carried paint: a square around the dab center, in dab-local coordinates
    let carry: Float32Array | null = null, side = 0;
    const tgt = { buf: new Float32Array(0) };
    return {
      mode: "normal",
      spacing: 0.1,
      direct(r, px, a, info) {
        const src = readFor(ctx, r, px);
        const s = Math.ceil(info.size) + 4;
        if (!carry || side !== s) {
          side = s;
          const prev = carry;
          carry = new Float32Array(s * s * 4);
          if (!prev) {
            // the first dab picks up what is under it (or the foreground color when finger painting)
            for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
              const X = Math.floor(info.x - s / 2) + x - r.x, Y = Math.floor(info.y - s / 2) + y - r.y, o = (y * s + x) * 4;
              if (finger) { carry[o] = ctx.fg[0]!; carry[o + 1] = ctx.fg[1]!; carry[o + 2] = ctx.fg[2]!; carry[o + 3] = 1; }
              else if (X >= 0 && Y >= 0 && X < r.w && Y < r.h) { const i = (Y * r.w + X) * 4; carry[o] = src[i]!; carry[o + 1] = src[i + 1]!; carry[o + 2] = src[i + 2]!; carry[o + 3] = src[i + 3]!; }
            }
            return;
          }
        }
        const n = r.w * r.h;
        if (tgt.buf.length < n * 4) tgt.buf = new Float32Array(n * 4);
        const t = tgt.buf;
        const ox = Math.floor(info.x - s / 2), oy = Math.floor(info.y - s / 2);
        for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
          const cx = r.x + x - ox, cy = r.y + y - oy, i = (y * r.w + x) * 4;
          if (cx >= 0 && cy >= 0 && cx < s && cy < s) { const o = (cy * s + cx) * 4; t[i] = carry[o]!; t[i + 1] = carry[o + 1]!; t[i + 2] = carry[o + 2]!; t[i + 3] = carry[o + 3]!; }
          else { t[i] = px[i]!; t[i + 1] = px[i + 1]!; t[i + 2] = px[i + 2]!; t[i + 3] = px[i + 3]!; }
        }
        applyMode(mode, px, t.subarray(0, n * 4), a, strength, true);
        // the carried paint takes up some of what it now passes over
        for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
          const X = ox + x - r.x, Y = oy + y - r.y;
          if (X < 0 || Y < 0 || X >= r.w || Y >= r.h) continue;
          const i = (Y * r.w + X) * 4, o = (y * s + x) * 4, k = 1 - strength;
          for (let c = 0; c < 4; c++) carry[o + c] = carry[o + c]! + (src === px ? px[i + c]! : src[i + c]!) * k - carry[o + c]! * k;
        }
      },
    };
  },
});
