// The theme wave: a page-wide restyle (color theme, light / dark, accent) revealed from the pressed point by a circle
// of the new look that grows (View Transitions + a clip-path animation on the new snapshot), or, with
// shape: "spray", sprayed on in soft patches and specks that spread out until the screen is covered (a mask
// animation on the new snapshot). Without View Transitions, with reduced motion or while motion is paused, the change
// simply lands at once.
//   themeWave(() => setColorTheme("aurora"), { origin: button })
//   themeWave(() => setTheme("dark"), { shape: "spray" })
//   installThemeWave()        // every setTheme / setColorTheme / setAccent from now on (ThemeMenu, ThemeToggle, AccentPicker…)
import { animateEl } from "./env.ts";
import { reducedNow } from "./engine/prefs.ts";
import { pausedNow } from "./engine/config.ts";
import { setRestyleTransition } from "../ui/restyle.ts";

export interface ThemeWaveOptions {
  /** Where the circle starts: a viewport point, an element (its centre) or nothing (the top centre of the page). */
  origin?: { x: number; y: number } | Element | null | undefined;
  /** How the new look arrives: a growing circle (default) or sprayed on in patches until it covers the screen. */
  shape?: "circle" | "spray" | undefined;
  /** ms (default 700 for the circle, 1100 for the spray). */
  duration?: number | undefined;
  /** CSS easing (default a fast start with a soft landing). */
  easing?: string | undefined;
}

interface VT { finished: Promise<void>; ready: Promise<void> }
let running = 0;

/** Run a restyle as a circle of the new look growing from `origin`. Resolves when the wave is over. */
export function themeWave(change: () => void, o: ThemeWaveOptions = {}): Promise<void> {
  const doc = globalThis.document as (Document & { startViewTransition?: (cb: () => void) => VT }) | undefined;
  const root = doc?.documentElement;
  if (!doc || !root || typeof doc.startViewTransition !== "function" || reducedNow() || pausedNow()) { change(); return Promise.resolve(); }
  const w = globalThis.innerWidth || root.clientWidth, h = globalThis.innerHeight || root.clientHeight;
  let x = w / 2, y = 0;
  const from = o.origin;
  if (from && "getBoundingClientRect" in from) { const r = from.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
  else if (from) { x = from.x; y = from.y; }
  // far enough to reach the farthest corner
  const reach = Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
  running++;
  root.setAttribute("data-m-wave", "");
  let vt: VT;
  try { vt = doc.startViewTransition(change); } catch { if (!--running) root.removeAttribute("data-m-wave"); change(); return Promise.resolve(); }
  vt.ready.then(() => {
    if (o.shape === "spray") animateEl(root, sprayFrames(x, y, w, h), { duration: o.duration ?? 1100, easing: "linear", pseudoElement: "::view-transition-new(root)" });
    else animateEl(root, [{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${reach}px at ${x}px ${y}px)` }],
      { duration: o.duration ?? 700, easing: o.easing ?? "cubic-bezier(.3, .7, .2, 1)", pseudoElement: "::view-transition-new(root)" });
  }).catch(() => undefined);
  return vt.finished.catch(() => undefined).then(() => { if (!--running) root.removeAttribute("data-m-wave"); });
}

/** One spot of paint: centre, full radius, when it starts (0–1 of the wave) and how long it takes to grow. */
interface Spot { x: number; y: number; r: number; at: number; grow: number }
const STEPS = 30;

/**
 * The spray as mask keyframes: soft patches on a jittered grid (together they cover the screen) start one after the
 * other, nearest the origin first, each a little late or early, and grow out; fine specks fly ahead of them. Masks do
 * not tween, so the wave is a run of close frames (that also gives the spray its burst-by-burst look); the last frame
 * is a full mask.
 */
export function sprayFrames(ox: number, oy: number, w: number, h: number, rnd: () => number = Math.random): Keyframe[] {
  const cell = Math.max(w, h) / 8, cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / cell) + 1;
  const far = Math.hypot(Math.max(ox, w - ox), Math.max(oy, h - oy)) || 1;
  const spots: Spot[] = [];
  // the first burst right where the press was
  spots.push({ x: ox, y: oy, r: cell * 1.1, at: 0, grow: 0.3 });
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = (i + 0.5 * (rnd() - 0.5)) * cell, y = (j + 0.5 * (rnd() - 0.5)) * cell
    const d = Math.hypot(x - ox, y - oy) / far
    const patch = { x, y, r: cell * (1.05 + 0.25 * rnd()), at: Math.min(0.72, d * 0.6 + 0.14 * rnd()), grow: 0.16 + 0.12 * rnd() }
    spots.push(patch)
    // the overspray: a few fine drops just outside the patch, landing while it grows
    for (let k = 0; k < 4; k++) {
      const a = rnd() * Math.PI * 2, at = patch.r * (1 + 0.3 * rnd())
      spots.push({ x: x + Math.cos(a) * at, y: y + Math.sin(a) * at, r: 1.5 + 3 * rnd(), at: patch.at + patch.grow * 0.4, grow: 0.04 })
    }
  }
  // specks: small hard dots a step ahead of the patches
  for (let k = 0; k < 70; k++) {
    const a = rnd() * Math.PI * 2, d = rnd() * far
    const x = ox + Math.cos(a) * d, y = oy + Math.sin(a) * d
    if (x < -10 || y < -10 || x > w + 10 || y > h + 10) continue
    spots.push({ x, y, r: 3 + 9 * rnd(), at: Math.max(0, (d / far) * 0.6 - 0.12 * rnd()), grow: 0.06 })
  }
  const frames: Keyframe[] = [];
  for (let k = 0; k <= STEPS; k++) {
    const t = k / STEPS;
    let mask: string;
    if (k === STEPS) mask = "linear-gradient(#000, #000)";
    else {
      const parts: string[] = [];
      for (const s of spots) {
        const p = (t - s.at) / s.grow;
        if (p <= 0) continue;
        const r = s.r * (1 - (1 - Math.min(1, p)) ** 3);
        if (r < 1) continue;
        const px = (n: number) => `${Math.round(n)}px`;
        parts.push(`radial-gradient(circle at ${px(s.x)} ${px(s.y)}, #000 ${px(r * 0.55)}, rgba(0,0,0,.55) ${px(r * 0.8)}, transparent ${px(r)})`);
      }
      mask = parts.length ? parts.join(", ") : "linear-gradient(transparent, transparent)";
    }
    frames.push({ offset: t, maskImage: mask, webkitMaskImage: mask } as Keyframe);
  }
  return frames;
}

/**
 * From now on every page-wide restyle (setTheme, setColorTheme, setAccent — so ThemeMenu, ThemePicker, ThemeToggle,
 * AccentPicker and your own calls) spreads from the point that was pressed last (a click, a tap, or the focused
 * control for a key press). Returns a function that turns it off.
 */
export function installThemeWave(o: Omit<ThemeWaveOptions, "origin"> = {}): () => void {
  const view = globalThis.document;
  if (!view) return () => undefined;
  let last: { x: number; y: number; at: number } | null = null;
  const press = (e: Event): void => { const p = e as PointerEvent; last = { x: p.clientX, y: p.clientY, at: Date.now() }; };
  const key = (e: Event): void => {
    const k = (e as KeyboardEvent).key;
    if (k !== "Enter" && k !== " ") return;
    const r = globalThis.document?.activeElement?.getBoundingClientRect?.();
    if (r && (r.width || r.height)) last = { x: r.left + r.width / 2, y: r.top + r.height / 2, at: Date.now() };
  };
  view.addEventListener("pointerdown", press, { capture: true, passive: true });
  view.addEventListener("keydown", key, { capture: true, passive: true });
  // a press counts for a while: a theme's stylesheet may still be loading when the choice is made
  const off = setRestyleTransition((apply) => { void themeWave(apply, { ...o, origin: last && Date.now() - last.at < 5000 ? last : null }); });
  return () => { off(); view.removeEventListener("pointerdown", press, { capture: true }); view.removeEventListener("keydown", key, { capture: true }); };
}
