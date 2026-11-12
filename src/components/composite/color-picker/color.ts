// Color math of ColorPicker and GradientEditor: HSVA as the editing model, any CSS color in (through the motion
// engine's parser: hex, rgb(), oklab(), oklch(), names), hex / rgb() / hsl() out.
import { parseColor, oklabToRgba } from "../../../motion/engine/color.ts";
import { clamp } from "../../../core/util.ts";
import { contrast } from "../../../theme/contrast.ts";
import { tokenColor } from "../../../theme/colors.ts";

/** Hue 0–360, saturation / value / alpha 0–1. */
export interface Hsva { h: number; s: number; v: number; a: number }
export interface Rgba { r: number; g: number; b: number; a: number }
export type ColorFormat = "hex" | "rgb" | "hsl";

export function hsvToRgb({ h, s, v, a }: Hsva): Rgba {
  const f = (n: number): number => { const k = (n + h / 60) % 6; return v - v * s * clamp(Math.min(k, 4 - k), 0, 1); };
  return { r: f(5) * 255, g: f(3) * 255, b: f(1) * 255, a };
}
export function rgbToHsv({ r, g, b, a }: Rgba, hue = 0): Hsva {
  const R = r / 255, G = g / 255, B = b / 255, max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  let h = hue;
  if (d) h = 60 * (max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4);
  return { h: (h + 360) % 360, s: max ? d / max : 0, v: max, a };
}

/** Any CSS color → RGBA (null when it does not parse). `hue` is kept for greys (they have none of their own). */
export function parse(input: string): Rgba | null {
  const lab = [0, 0, 0, 0], out = [0, 0, 0, 0];
  if (!parseColor(String(input ?? ""), lab)) {
    const m = /^hsla?\(\s*(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(String(input).trim());
    if (!m) return null;
    const hh = +m[1]!, ss = +m[2]! / 100, ll = +m[3]! / 100, aa = m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : +m[4];
    const v = ll + ss * Math.min(ll, 1 - ll);
    return hsvToRgb({ h: hh, s: v ? 2 * (1 - ll / v) : 0, v, a: clamp(aa, 0, 1) });
  }
  oklabToRgba(lab, 0, out);
  return { r: clamp(out[0]! * 255, 0, 255), g: clamp(out[1]! * 255, 0, 255), b: clamp(out[2]! * 255, 0, 255), a: clamp(out[3]!, 0, 1) };
}

const hx = (n: number): string => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");
/** RGBA → "#rrggbb" or "#rrggbbaa", "rgb(r g b / a)" or "hsl(h s% l% / a)". */
export function format(c: Rgba, f: ColorFormat = "hex", hue?: number): string {
  const a = Math.round(c.a * 100) / 100;
  if (f === "hex") return `#${hx(c.r)}${hx(c.g)}${hx(c.b)}${a < 1 ? hx(a * 255) : ""}`;
  if (f === "rgb") return `rgb(${Math.round(c.r)} ${Math.round(c.g)} ${Math.round(c.b)}${a < 1 ? ` / ${a}` : ""})`;
  const { h, s, v } = rgbToHsv(c, hue);
  const l = v * (1 - s / 2), sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
  return `hsl(${Math.round(h)} ${Math.round(sl * 100)}% ${Math.round(l * 100)}%${a < 1 ? ` / ${a}` : ""})`;
}

/** WCAG contrast ratio of two colors (1–21; alpha ignored), with the theme's contrast helper. */
export const contrastOf = (a: Rgba, b: Rgba): number => contrast(format({ ...a, a: 1 }), format({ ...b, a: 1 }));
/** Blend two RGBA colors (t = 0 → a, 1 → b), in sRGB. */
export const mix = (a: Rgba, b: Rgba, t: number): Rgba => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: a.a + (b.a - a.a) * t });

/** A theme token ("brand-orange", "cat-3", "primary") → the color it has under `el` (a CSS color passes through). */
export function resolveColor(token: string, el?: Element | null): string {
  if (!/^[a-z]+(-[a-z0-9]+)*$/.test(token) || parse(token)) return token;
  const style = el ? globalThis.getComputedStyle?.(el) : null;
  if (!style) return token;
  for (const m of tokenColor(token).matchAll(/var\((--[\w-]+)/g)) { const v = style.getPropertyValue(m[1]!).trim(); if (v && parse(v)) return v; }
  return token;
}
