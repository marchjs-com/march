// The theme wave: a page-wide restyle (color theme, light / dark, accent) brought in with a transition.
//   circle (default)  a circle of the new look grows from the pressed point (View Transitions + a clip-path animation
//                     on the new snapshot)
//   drip, spray, sweep, splat  painted on (theme-paint.ts, a lazy part loaded the first time one runs): the page takes
//                     the new look at once and stays live and usable while a passive live copy in the old look above
//                     it is painted away (paint running down from the top; a nozzle in strokes; a sweep row by row;
//                     patches bursting from the press)
// Without View Transitions (circle) or mask compositing (paint), with reduced motion or while motion is paused, the
// change simply lands at once.
//   themeWave(() => setColorTheme("aurora"), { origin: button })
//   themeWave(() => setTheme("dark"), { shape: "drip" })
//   installThemeWave({ shape: "drip" })   // every setTheme / setColorTheme / setAccent from now on
import { animateEl } from "./env.ts";
import { reducedNow } from "./engine/prefs.ts";
import { pausedNow } from "./engine/config.ts";
import { setRestyleTransition } from "../ui/restyle.ts";

export type ThemeWaveShape = "circle" | "drip" | "spray" | "sweep" | "splat";

export interface ThemeWaveOptions {
  /** Where the circle (and the splat) starts: a viewport point, an element (its centre) or nothing (the top centre). */
  origin?: { x: number; y: number } | Element | null | undefined;
  /** How the new look arrives (default "circle"); every other shape paints it on and loads its part lazily. */
  shape?: ThemeWaveShape | undefined;
  /** ms (default 700 for the circle, 1600 for the painted shapes). */
  duration?: number | undefined;
  /** CSS easing of the circle (default a fast start with a soft landing). */
  easing?: string | undefined;
}

interface VT { finished: Promise<void>; ready: Promise<void> }
let running = 0;
/** The painted shapes' part, loaded once. */
const paint = (): Promise<typeof import("./theme-paint.ts")> => import("./theme-paint.ts");

/** Run a restyle as a wave of the new look. Resolves when the wave is over. */
export function themeWave(change: () => void, o: ThemeWaveOptions = {}): Promise<void> {
  const doc = globalThis.document as (Document & { startViewTransition?: (cb: () => void) => VT }) | undefined;
  const root = doc?.documentElement;
  if (!doc || !root || reducedNow() || pausedNow()) { change(); return Promise.resolve(); }
  const w = globalThis.innerWidth || root.clientWidth, h = globalThis.innerHeight || root.clientHeight;
  let x = w / 2, y = 0;
  const from = o.origin;
  if (from && "getBoundingClientRect" in from) { const r = from.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
  else if (from) { x = from.x; y = from.y; }
  const shape = o.shape ?? "circle";
  if (shape !== "circle") return paint().then((m) => m.paintWave(doc, change, { shape, origin: { x, y }, duration: o.duration }), () => { change(); });
  if (typeof doc.startViewTransition !== "function") { change(); return Promise.resolve(); }
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
 * AccentPicker and your own calls) runs as a wave, from the point that was pressed last (a click, a tap, or the
 * focused control for a key press). A painted shape's part is loaded ahead. Returns a function that turns it off.
 */
export function installThemeWave(o: Omit<ThemeWaveOptions, "origin"> = {}): () => void {
  const view = globalThis.document;
  if (!view) return () => undefined;
  if (o.shape && o.shape !== "circle") void paint().catch(() => undefined);
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
