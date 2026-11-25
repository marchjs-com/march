// Toning family: dodge and burn (range shadows / midtones / highlights, exposure, protect tones) and sponge
// (saturate / desaturate, flow, vibrance).

import { bool, choice, optBool, optBrush, optHardness, optPct, optSize, optSmoothing, optStr, pct, strokeTool, type PaintTool } from "./paint-common.ts";
import type { ToolContext } from "./tool.ts";
import type { StrokeSettings } from "../brush/engine.ts";

const luma = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b;

/** How much a tone range affects a value (0–1). */
export function rangeWeight(range: string, v: number): number {
  const ss = (e0: number, e1: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  if (range === "shadows") return 1 - ss(0, 0.75, v);
  if (range === "highlights") return ss(0.25, 1, v);
  return Math.max(0, 1 - (2 * v - 1) * (2 * v - 1));
}

function toneSetup(ctx: ToolContext, dir: 1 | -1): Partial<StrokeSettings> {
  const range = optStr(ctx, "range", "midtones"), exposure = optPct(ctx, "exposure", 50), protect = optBool(ctx, "protectTones", true);
  return {
    mode: "normal",
    direct(r, px, a) {
      for (let p = 0; p < a.length; p++) {
        const k = a[p]! * exposure * 0.5;
        if (k <= 0) continue;
        const i = p * 4, R = px[i]!, G = px[i + 1]!, B = px[i + 2]!;
        if (protect) {
          // change the luminance only: hue and saturation stay
          const L = luma(R, G, B), w = rangeWeight(range, L) * k;
          const L2 = dir > 0 ? L + (1 - L) * w : L * (1 - w);
          if (L > 1e-5) {
            let s = L2 / L;
            const mx = Math.max(R, G, B);
            if (mx * s > 1) s = 1 / mx; // keep the hue: never clip a channel alone
            px[i] = R * s; px[i + 1] = G * s; px[i + 2] = B * s;
            if (L2 > L * s + 1e-4) { const t = (L2 - L * s) / (1 - L * s); for (let c = 0; c < 3; c++) px[i + c] = px[i + c]! + (1 - px[i + c]!) * t; }
          } else if (dir > 0) { px[i] = px[i + 1] = px[i + 2] = L2; }
        } else {
          for (let c = 0; c < 3; c++) {
            const v = px[i + c]!, w = rangeWeight(range, v) * k;
            px[i + c] = dir > 0 ? v + (1 - v) * w : v * (1 - w);
          }
        }
      }
      void r;
    },
  };
}

const toneOptions = () => [
  optBrush("dodge-soft"), optSize(90), optHardness(0),
  choice("range", "Range", "midtones", [["shadows", "Shadows"], ["midtones", "Midtones"], ["highlights", "Highlights"]]),
  pct("exposure", "Exposure", 50), bool("protectTones", "Protect tones", true), bool("airbrush", "Airbrush", false), ...optSmoothing(),
];

export const dodgeTool: PaintTool = strokeTool({
  id: "dodge", group: "tone", label: "Dodge", icon: "dodge", key: "O", step: "Dodge", brush: "dodge-soft",
  options: toneOptions(), setup: (ctx) => toneSetup(ctx, 1),
});

export const burnTool: PaintTool = strokeTool({
  id: "burn", group: "tone", label: "Burn", icon: "burn", key: "O", step: "Burn", brush: "dodge-soft",
  options: toneOptions(), setup: (ctx) => toneSetup(ctx, -1),
});

export const spongeTool: PaintTool = strokeTool({
  id: "sponge", group: "tone", label: "Sponge", icon: "sponge", key: "O", step: "Sponge", brush: "soft-round",
  options: [
    optBrush("soft-round"), optSize(60), optHardness(0),
    choice("spongeMode", "Mode", "desaturate", [["saturate", "Saturate"], ["desaturate", "Desaturate"]]),
    pct("flow", "Flow", 50), bool("vibrance", "Vibrance", true), bool("airbrush", "Airbrush", false), ...optSmoothing(),
  ],
  setup(ctx) {
    const sat = optStr(ctx, "spongeMode", "desaturate") === "saturate", vib = optBool(ctx, "vibrance", true);
    return {
      mode: "normal",
      direct(_r, px, a) {
        // a already carries the flow
        for (let p = 0; p < a.length; p++) {
          let k = a[p]! * 0.5;
          if (k <= 0) continue;
          const i = p * 4, R = px[i]!, G = px[i + 1]!, B = px[i + 2]!, L = luma(R, G, B);
          const mx = Math.max(R, G, B), mn = Math.min(R, G, B), s = mx > 0 ? (mx - mn) / mx : 0;
          if (vib) k *= sat ? 1 - s : 0.35 + 0.65 * s; // vibrance: go easy on saturated colors (or on dull ones when draining)
          let f = sat ? 1 + k : 1 - k;
          if (sat) {
            // never push a channel out of range (that would shift the hue)
            for (const c of [R, G, B]) { const d = c - L; if (d > 0 && L + d * f > 1) f = (1 - L) / d; else if (d < 0 && L + d * f < 0) f = -L / d; }
          }
          px[i] = L + (R - L) * f; px[i + 1] = L + (G - L) * f; px[i + 2] = L + (B - L) * f;
        }
      },
    };
  },
});
