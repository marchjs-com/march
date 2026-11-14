// The theme wave: a page-wide restyle (color theme, light / dark, accent) revealed by a circle of the new look that
// grows from the pressed point (View Transitions + a clip-path animation on the new snapshot). Without View
// Transitions, with reduced motion or while motion is paused, the change simply lands at once.
//   themeWave(() => setColorTheme("aurora"), { origin: button })
//   installThemeWave()        // every setTheme / setColorTheme / setAccent from now on (ThemeMenu, ThemeToggle, AccentPicker…)
import { animateEl } from "./env.ts";
import { reducedNow } from "./engine/prefs.ts";
import { pausedNow } from "./engine/config.ts";
import { setRestyleTransition } from "../ui/restyle.ts";

export interface ThemeWaveOptions {
  /** Where the circle starts: a viewport point, an element (its centre) or nothing (the top centre of the page). */
  origin?: { x: number; y: number } | Element | null | undefined;
  /** ms (default 700). */
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
    animateEl(root, [{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${reach}px at ${x}px ${y}px)` }],
      { duration: o.duration ?? 700, easing: o.easing ?? "cubic-bezier(.3, .7, .2, 1)", pseudoElement: "::view-transition-new(root)" });
  }).catch(() => undefined);
  return vt.finished.catch(() => undefined).then(() => { if (!--running) root.removeAttribute("data-m-wave"); });
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
