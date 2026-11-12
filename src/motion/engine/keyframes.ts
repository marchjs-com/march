// Named keyframes and presets: define once, play anywhere (`animate(el, "fadeUp")`, timelines, transitions), and
// export the same definitions as one CSS file (`keyframesCss()`) for pure-CSS use — `class="hm-anim-fadeUp"`.
import { normalize, type Frames } from "./tracks.ts";
import { ease, cssFallback, type EaseInput } from "./ease.ts";

export interface Timing {
  /** ms (springs bring their own natural duration when none is given). */
  duration?: number;
  delay?: number;
  endDelay?: number;
  easing?: EaseInput;
  iterations?: number;
  direction?: PlaybackDirection;
  fill?: FillMode;
}
export interface KeyframesDef { readonly name: string; readonly frames: Frames; readonly defaults: Timing }

const REG = new Map<string, KeyframesDef | { name: string; use: string; defaults: Timing }>();

/** Register named keyframes with default timing. Returns the definition (usable directly with animate()). */
export function keyframes(name: string, frames: Frames, defaults: Timing = {}): KeyframesDef {
  const def: KeyframesDef = { name, frames, defaults };
  REG.set(name, def);
  return def;
}
/** A preset: existing keyframes with other timing (`preset("modalIn", "zoomIn", { duration: 180, easing: "spring" })`). */
export function preset(name: string, use: string, defaults: Timing = {}): void { REG.set(name, { name, use, defaults }); }

/** Look up keyframes or a preset by name (presets resolve to their keyframes with merged timing). */
export function getKeyframes(name: string): KeyframesDef | null {
  const d = REG.get(name);
  if (!d) return null;
  if ("frames" in d) return d;
  const base = getKeyframes(d.use);
  return base ? { name, frames: base.frames, defaults: { ...base.defaults, ...d.defaults } } : null;
}
export const keyframeNames = (): string[] => [...REG.keys()];

const kebab = (p: string): string => (p.startsWith("--") ? p : p.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`));
const UNITLESS = /opacity|scale|z-index|^--|flex-grow|order/;
const val = (k: string, v: unknown): string => (typeof v === "number" && !UNITLESS.test(k) ? `${v}px` : String(v));

/**
 * One CSS file from every registered keyframes (or `names`): `@keyframes hm-<name>` and a `.hm-anim-<name>` class
 * with the default timing. Reduced motion (system or the user setting, `<html data-hm-reduced>`) ends them at once.
 * Easings without a CSS form (custom JS functions) fall back to the default curve.
 */
export function keyframesCss({ names, prefix = "hm-" }: { names?: string[]; prefix?: string } = {}): string {
  const out: string[] = [];
  const list = names ?? keyframeNames();
  for (const name of list) {
    const def = getKeyframes(name);
    if (!def) continue;
    const id = `${prefix}${name}`;
    if (REG.get(name) && "frames" in REG.get(name)!) {
      const byOff = new Map<number, string[]>();
      for (const t of normalize(def.frames)) {
        t.offsets.forEach((o, i) => {
          const v = t.values[i];
          if (v == null || typeof v === "object") return;
          const arr = byOff.get(o) ?? [];
          arr.push(`${kebab(t.prop)}: ${val(kebab(t.prop), v)}`);
          const e = t.eases[i];
          if (e != null && !arr.some((x) => x.startsWith("animation-timing-function"))) { const ez = ease(e, "linear"); if (ez.css) arr.push(`animation-timing-function: ${ez.css}`); }
          byOff.set(o, arr);
        });
      }
      const body = [...byOff.keys()].sort((a, b) => a - b).map((o) => `  ${Math.round(o * 10000) / 100}% { ${byOff.get(o)!.join("; ")}; }`).join("\n");
      out.push(`@keyframes ${id} {\n${body}\n}`);
    }
    const d = def.defaults;
    const e = ease(d.easing ?? "out");
    const dur = d.duration ?? e.duration ?? 300;
    const kf = REG.get(name) && "frames" in REG.get(name)! ? id : `${prefix}${(REG.get(name) as { use: string }).use}`;
    const iter = d.iterations === Infinity ? "infinite" : `${d.iterations ?? 1}`;
    // springs and bounces: linear() for browsers that have it, a close cubic-bezier before it for the rest
    const lin = e.css?.startsWith("linear(") ? ` animation-timing-function: ${e.css};` : "";
    out.push(`.${prefix}anim-${name} { animation: ${kf} ${Math.round(dur)}ms ${cssFallback(e)} ${d.delay ?? 0}ms ${iter} ${d.direction ?? "normal"} ${d.fill ?? "both"};${lin} }`);
  }
  if (list.length) {
    const sel = list.map((n) => `.${prefix}anim-${n}`).join(", ");
    out.push(`:root[data-hm-reduced] :is(${sel}) { animation-duration: 1ms; animation-delay: 0ms; animation-iteration-count: 1; }`);
    out.push(`@media (prefers-reduced-motion: reduce) { :is(${sel}) { animation-duration: 1ms; animation-delay: 0ms; animation-iteration-count: 1; } }`);
  }
  return out.join("\n") + "\n";
}
