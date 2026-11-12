// Motion environment: reduced-motion preference (live), frame scheduling, element style helpers (CSSOM only — CSP safe).
// Frames and time come from the engine's one clock (engine/clock.ts): global speed, pause and slow motion apply to
// everything that schedules through here (springs, tweens, marquee, fx particles, scroll effects).
import { reducedMotion as reducedPref, setReducedOverride } from "./engine/prefs.ts";
import { nextFrame, onFrame, now as clockNow } from "./engine/clock.ts";
import { startNative } from "./engine/native.ts";

/** True when the user asked for reduced motion (live). Animations shorten to a near-instant fade or skip. */
export const reducedMotion = (): boolean => reducedPref();
/** Force reduced motion on/off (tests, user setting); null follows the system again. */
export function setReducedMotion(on: boolean | null): void { setReducedOverride(on); }

/** Engine clock time (ms): scaled by the global speed, frozen while motion is paused. */
export const now = (): number => clockNow();

/** Run `fn(time)` on the next frame of the shared clock. Returns a cancel function. */
export function frame(fn: (t: number) => void): () => void {
  return nextFrame((t) => fn(t));
}

/** Run `fn(dt)` every frame of the shared clock (dt in clock ms: scaled by the global speed; nothing runs while motion
 *  is paused). For canvas drawing loops in components: never a private requestAnimationFrame loop. Returns stop. */
export function frameLoop(fn: (dt: number) => void): () => void {
  return onFrame((_t, dt) => fn(dt), { phase: "render" });
}

/** A raw WAAPI animation for a component that needs the Animation object (marquee, a small pop): it follows the global
 *  speed, "pause all" and reduced motion like every engine animation. Null where WAAPI is missing. Prefer animate(). */
export function animateEl(el: Element, frames: Keyframe[] | PropertyIndexedKeyframes, opts: KeyframeAnimationOptions): Animation | null {
  return startNative(el, frames, opts);
}

/** Set CSS properties through CSSOM (never the style attribute string). */
export function setStyle(el: Element, props: Record<string, string | number | null>): void {
  const s = (el as HTMLElement).style;
  if (!s) return;
  for (const [k, v] of Object.entries(props)) {
    const name = k.startsWith("--") ? k : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    if (v == null || v === "") s.removeProperty(name);
    else s.setProperty(name, typeof v === "number" && !/opacity|scale|z-index/.test(name) ? `${v}px` : String(v));
  }
}

/** Milliseconds from a CSS duration token (e.g. "--hm-dur-2") or a number. */
export function ms(v: number | string | undefined, fallback: number): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return v.trim().endsWith("ms") || !v.trim().endsWith("s") ? n : n * 1000;
  }
  return fallback;
}
