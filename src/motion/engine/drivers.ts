// Drivers connect the value layer to a kind of target. The engine knows nothing about DOM, canvas or WebGL: it asks
// the target's driver to apply sampled tracks (JS path) or to start a native animation (WAAPI path).
//   dom     Elements: WAAPI first (compositor-only properties run off the main thread), CSSOM writes as fallback
//   cssVar  CSS custom properties, registered with @property (CSS.registerProperty) so they interpolate natively
//   object  plain objects / arrays / typed arrays (numbers written in place, no allocation)
//   canvas2d, webgl in their own modules (canvas.ts, webgl.ts): only bundled when used
// defineDriver() adds new kinds of targets (Three.js objects, SVG paths, audio params…).
import { DEV } from "../../core/reactive.ts";
import type { Track, Value } from "./tracks.ts";

export interface Driver<T = unknown> {
  readonly name: string;
  /** Does this driver handle the target? (Custom drivers are asked first.) */
  supports(target: unknown): boolean;
  /** Write one sampled track to the target (JS path, write phase). */
  apply(target: T, track: Track): void;
  /** Once per frame after every apply (render phase): draw a canvas, upload uniforms… */
  flush?(target: T): void;
  /** Current value of a property (implicit start / end keyframes on the JS path). */
  read?(target: T, prop: string): Value;
  /** Restore what was there before the animation (fill: "none" on the JS path). */
  restore?(target: T, prop: string): void;
  /** Start a native animation (paused) or return null to use the JS path. */
  native?(target: T, frames: Keyframe[], timing: KeyframeEffectOptions): Animation | null;
  /** The element whose visibility decides whether the target is worked on. */
  element?(target: T): Element | null;
  /** Animation of these properties starts / ends (will-change hints). */
  begin?(target: T, props: string[]): void;
  end?(target: T, props: string[]): void;
}
/** Targets can carry their own driver under this key (canvas2d(), webgl(), cssVars() targets do). */
export const DRIVER: unique symbol = Symbol.for("hm.motion.driver") as never;

const custom: Driver[] = [];
/** Register a driver for a new kind of target. Later registrations win over earlier ones and over the built-ins. */
export function defineDriver<T>(name: string, spec: Omit<Driver<T>, "name">): Driver<T> {
  const d = { name, ...spec } as Driver<T>;
  custom.unshift(d as Driver);
  return d;
}

const kebab = (p: string): string => (p.startsWith("--") ? p : p.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`));
/** Properties the compositor animates without layout or paint. */
export const COMPOSITOR = new Set(["transform", "opacity", "translate", "scale", "rotate", "filter", "backdrop-filter", "backdropFilter"]);
const warned = new Set<string>();

// will-change: counted per element and property, removed when the last animation of that property ends
const hints = new WeakMap<Element, Map<string, number>>();
const before = new WeakMap<Element, string>();
function hint(el: Element, props: string[], d: 1 | -1): void {
  const st = (el as HTMLElement).style;
  if (!st?.setProperty) return;
  let m = hints.get(el);
  if (!m) { if (d < 0) return; hints.set(el, (m = new Map())); before.set(el, st.getPropertyValue("will-change")); }
  for (const p of props) {
    const k = kebab(p);
    if (!COMPOSITOR.has(k)) continue;
    const c = (m.get(k) ?? 0) + d;
    if (c > 0) m.set(k, c); else m.delete(k);
  }
  const list = [...m.keys()].join(", ");
  if (list) st.setProperty("will-change", list);
  else { const b = before.get(el); if (b) st.setProperty("will-change", b); else st.removeProperty("will-change"); hints.delete(el); }
}

// custom properties must be registered (@property) to interpolate; otherwise they flip halfway
const registered = new Set<string>();
/** Register a CSS custom property so it animates smoothly (natively): `registerVar("--hue", "<number>", "0")`. */
export function registerVar(name: string, syntax: string, initial: string, inherits = true): boolean {
  if (registered.has(name)) return true;
  const CSSx = globalThis.CSS as unknown as { registerProperty?: (o: object) => void } | undefined;
  if (typeof CSSx?.registerProperty !== "function") return false;
  try { CSSx.registerProperty({ name, syntax, inherits, initialValue: initial }); }
  catch { /* already registered (by CSS @property or another bundle): fine */ }
  registered.add(name);
  return true;
}
function guessSyntax(v: unknown): [string, string] | null {
  if (typeof v === "number") return ["<number>", "0"];
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (/^-?[\d.]+$/.test(s)) return ["<number>", "0"];
  if (/^-?[\d.]+%$/.test(s)) return ["<percentage>", "0%"];
  if (/^-?[\d.]+(px|rem|em|vh|vw)$/.test(s)) return ["<length>", "0px"];
  if (/^-?[\d.]+(deg|turn|rad)$/.test(s)) return ["<angle>", "0deg"];
  if (/^(#|rgb|hsl|oklab|oklch)/.test(s)) return ["<color>", "transparent"];
  return null;
}

const saved = new WeakMap<Element, Map<string, string>>();
const isEl = (t: unknown): t is HTMLElement => !!t && typeof (t as Node).nodeType === "number" && (t as Node).nodeType === 1;

export const domDriver: Driver<HTMLElement> = {
  name: "dom",
  supports: isEl,
  apply(el, tr) {
    const k = kebab(tr.prop);
    let m = saved.get(el);
    if (!m) saved.set(el, (m = new Map()));
    if (!m.has(k)) m.set(k, el.style.getPropertyValue(k));
    el.style.setProperty(k, tr.scalar && !/opacity|scale|z-index|^--/.test(k) && k !== "flex-grow" ? `${tr.text()}px` : tr.text());
  },
  restore(el, prop) {
    const k = kebab(prop), m = saved.get(el);
    if (!m || !m.has(k)) return;
    const v = m.get(k);
    if (v) el.style.setProperty(k, v); else el.style.removeProperty(k);
    m?.delete(k);
  },
  read(el, prop) {
    const k = kebab(prop);
    const inline = el.style?.getPropertyValue?.(k);
    if (inline) return inline;
    return globalThis.getComputedStyle?.(el)?.getPropertyValue?.(k) || (k === "opacity" ? "1" : k === "transform" ? "none" : "");
  },
  native(el, frames, timing) {
    if (typeof el.animate !== "function") return null;
    for (const f of frames) for (const k in f) {
      if (k === "offset" || k === "easing" || k === "composite") continue;
      if (k.startsWith("--")) { const g = guessSyntax(f[k]); if (!g || !registerVar(k, g[0], g[1])) return null; }
      else if (DEV.enabled && !COMPOSITOR.has(kebab(k)) && !warned.has(k)) {
        warned.add(k);
        DEV.warn(`motion: "${k}" is not compositor-only; prefer transform / opacity / filter`);
      }
    }
    const a = el.animate(frames, timing);
    a.pause();
    return a;
  },
  element: (el) => el,
  begin: (el, props) => hint(el, props, 1),
  end: (el, props) => hint(el, props, -1),
};

/** A CSS custom property target: `cssVars(el, { "--hue": "<number>" })` registers the properties, then animates them. */
export interface CssVarTarget { readonly el: HTMLElement; readonly [DRIVER]: Driver }
export const cssVarDriver: Driver<CssVarTarget> = {
  name: "cssVar",
  supports: (t) => !!t && (t as CssVarTarget)[DRIVER] === cssVarDriver,
  apply: (t, tr) => t.el.style.setProperty(tr.prop, tr.text()),
  restore: (t, p) => domDriver.restore!(t.el, p),
  read: (t, p) => t.el.style.getPropertyValue(p) || globalThis.getComputedStyle?.(t.el)?.getPropertyValue?.(p) || "",
  native: (t, frames, timing) => (typeof t.el.animate === "function" ? (() => { const a = t.el.animate(frames, timing); a.pause(); return a; })() : null),
  element: (t) => t.el,
};
/** Animate CSS custom properties of an element (registered with @property so they interpolate). */
export function cssVars(el: HTMLElement, vars: Record<string, string | { syntax: string; initial: string }> = {}): CssVarTarget {
  for (const [name, v] of Object.entries(vars)) {
    const syntax = typeof v === "string" ? v : v.syntax;
    const initial = typeof v === "string" ? (syntax === "<color>" ? "transparent" : syntax === "<length>" ? "0px" : syntax === "<percentage>" ? "0%" : syntax === "<angle>" ? "0deg" : "0") : v.initial;
    registerVar(name, syntax, initial);
  }
  return { el, [DRIVER]: cssVarDriver };
}

/** Write a sampled track into a plain object: numbers stay numbers, arrays / typed arrays are filled in place. */
export function writeInto(obj: Record<string, unknown>, tr: Track): void {
  const cur = obj[tr.prop];
  if (tr.vector || (cur != null && typeof cur === "object" && "length" in cur)) {
    let arr = cur as { [i: number]: number; length: number } | undefined;
    if (!arr || typeof arr !== "object") obj[tr.prop] = arr = new Array<number>(tr.n).fill(0);
    for (let i = 0; i < tr.n; i++) arr[i] = tr.out[i]!;
  } else obj[tr.prop] = tr.scalar ? tr.out[0]! : tr.text();
}
export const objectDriver: Driver<Record<string, unknown>> = {
  name: "object",
  supports: (t) => !!t && (typeof t === "object" || typeof t === "function"),
  apply: writeInto,
  read: (t, p) => t[p] as Value,
};

/** The driver for a target: its own, then custom drivers, then dom, then object. */
export function driverFor(target: unknown): Driver {
  const own = target && typeof target === "object" ? (target as { [DRIVER]?: Driver })[DRIVER] : undefined;
  if (own) return own;
  for (const d of custom) if (d.supports(target)) return d;
  if (domDriver.supports(target)) return domDriver as Driver;
  return objectDriver as Driver;
}
