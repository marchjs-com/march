// Gradients as data: { type, angle, stops } ⇄ CSS (linear-gradient, radial-gradient, conic-gradient).
import { parse, format, mix, type Rgba } from "../color-picker/color.ts";
import { clamp } from "../../../core/util.ts";

export type GradientType = "linear" | "radial" | "conic";
export interface GradientStop { color: string; at: number }
export interface Gradient { type: GradientType; angle: number; stops: GradientStop[] }

const round = (n: number): number => Math.round(n * 10) / 10;
/** CSS of a gradient (stops sorted by position). */
export function gradientCss(g: Gradient): string {
  const stops = [...g.stops].sort((a, b) => a.at - b.at).map((s) => `${s.color} ${round(s.at)}%`).join(", ");
  if (g.type === "radial") return `radial-gradient(circle, ${stops})`;
  if (g.type === "conic") return `conic-gradient(from ${round(g.angle)}deg, ${stops})`;
  return `linear-gradient(${round(g.angle)}deg, ${stops})`;
}

/** Split on top-level commas (not inside parentheses). */
function parts(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && !depth) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const SIDE: Record<string, number> = { top: 0, right: 90, bottom: 180, left: 270, "top right": 45, "right top": 45, "bottom right": 135, "right bottom": 135, "bottom left": 225, "left bottom": 225, "top left": 315, "left top": 315 };

/** Parse a CSS gradient (the forms gradientCss writes and the common hand-written ones). Null when it is not one. */
export function parseGradient(css: string): Gradient | null {
  const m = /^\s*(repeating-)?(linear|radial|conic)-gradient\(([\s\S]*)\)\s*$/i.exec(String(css ?? ""));
  if (!m) return null;
  const type = m[2]!.toLowerCase() as GradientType;
  const list = parts(m[3]!);
  let angle = type === "linear" ? 180 : 0;
  const head = list[0] ?? "";
  if (type === "linear" && /^(-?[\d.]+)(deg|turn|rad)$|^to\s+/.test(head)) {
    list.shift();
    const a = /^(-?[\d.]+)(deg|turn|rad)$/.exec(head);
    angle = a ? (a[2] === "turn" ? +a[1]! * 360 : a[2] === "rad" ? (+a[1]! * 180) / Math.PI : +a[1]!) : SIDE[head.replace(/^to\s+/, "").trim()] ?? 180;
  } else if (type === "conic" && /^from\s/.test(head)) {
    list.shift();
    angle = parseFloat(head.replace(/^from\s+/, "")) || 0;
  } else if (type === "radial" && !parse(head.split(/\s+/)[0]!)) list.shift();
  const stops: GradientStop[] = [];
  for (const p of list) {
    const pm = /^(.*?)(?:\s+(-?[\d.]+)%)?(?:\s+(-?[\d.]+)%)?$/.exec(p)!;
    if (!parse(pm[1]!.trim())) continue;
    stops.push({ color: pm[1]!.trim(), at: pm[2] != null ? +pm[2] : NaN });
    if (pm[3] != null) stops.push({ color: pm[1]!.trim(), at: +pm[3] });
  }
  if (stops.length < 2) return null;
  // stops without a position are spread evenly between their neighbours
  stops.forEach((s, i) => { if (Number.isNaN(s.at)) s.at = i === 0 ? 0 : i === stops.length - 1 ? 100 : NaN; });
  for (let i = 1; i < stops.length - 1; i++) {
    if (!Number.isNaN(stops[i]!.at)) continue;
    let j = i;
    while (Number.isNaN(stops[j]!.at)) j++;
    const a = stops[i - 1]!.at, b = stops[j]!.at;
    for (let k = i; k < j; k++) stops[k]!.at = a + ((b - a) * (k - i + 1)) / (j - i + 1);
  }
  return { type, angle: ((angle % 360) + 360) % 360, stops: stops.map((s) => ({ ...s, at: clamp(s.at, 0, 100) })) };
}

/** The color of the gradient at a position (0–100), in sRGB — for a stop added on the bar. */
export function colorAt(g: Gradient, at: number): string {
  const s = [...g.stops].sort((a, b) => a.at - b.at);
  const rgb = (x: GradientStop): Rgba => parse(x.color) ?? { r: 0, g: 0, b: 0, a: 1 };
  if (at <= s[0]!.at) return format(rgb(s[0]!));
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1]!, b = s[i]!;
    if (at <= b.at) return format(mix(rgb(a), rgb(b), b.at === a.at ? 0 : (at - a.at) / (b.at - a.at)));
  }
  return format(rgb(s[s.length - 1]!));
}
