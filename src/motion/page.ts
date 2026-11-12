// Page transitions for the router, on the motion engine: every frame of a page swap is an engine animation, so the
// global speed, "pause all", slow motion and reduced motion reach it like any other animation.
//   pageTransitions({ type: "slide" })                       — once at startup, after createRouter()
//   { path: "/photos/:id", meta: { transition: "scale" } }   — per route (the route left decides when going back)
//   <img data-hm-shared={`photo-${id}`}>                      — shared element: moves from the old page to the new one
// View Transitions API where supported (the engine animates the ::view-transition-old/new pseudo-elements), else the
// engine animates the old page out and the new one in. Back reverses the animation; "slide" follows the text
// direction (RTL mirrors it). Reduced motion or a paused engine: the swap is instant. Named outlets and the modal
// outlet get the same transitions (the modal's own dialog opens and closes it).
import { setNavigationWrapper, transitionOutlet, type NavInfo } from "../router/index.ts";
import type { OutletWrapper } from "../router/outlets.ts";
// the outlets module is the router's own lazy part: loaded here only to hand it the outlet transition
const outlets = (fn: OutletWrapper | null): Promise<void> => import("../router/outlets.ts").then((m) => m.setOutletWrapper(fn), () => undefined);
import { animate, ours } from "./engine/playback.ts";
import { DRIVER, type Driver } from "./engine/drivers.ts";
import { defaultTiming, pausedNow, rateScale } from "./engine/config.ts";
import { reducedNow } from "./engine/prefs.ts";

export type PageTransitionType = "fade" | "slide" | "scale" | "none";
/** A route's `meta.transition`: a type, or a type with its own timing. */
export interface PageTransitionSpec { type?: PageTransitionType; duration?: number; easing?: string; distance?: number }
export interface PageTransitionOptions extends PageTransitionSpec {
  /** Fallback target for the new page when the router outlet is not found (a selector). */
  target?: string;
  /** Use the View Transitions API where supported (default true). */
  viewTransitions?: boolean;
}
type Dir = "forward" | "back";

/** The keyframes of one side of a page transition (back reverses it; RTL mirrors "slide"). */
export function transitionFrames(type: PageTransitionType, side: "in" | "out", dir: Dir, rtl = false, distance = 32): Keyframe[] {
  const back = dir === "back";
  if (type === "none") return [];
  if (type === "fade") return side === "in" ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }];
  if (type === "scale") {
    const s = side === "in" ? (back ? 0.96 : 1.04) : (back ? 1.04 : 0.96);
    return side === "in" ? [{ opacity: 0, transform: `scale(${s})` }, { opacity: 1, transform: "none" }] : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: `scale(${s})` }];
  }
  // slide: forward = the new page comes from the inline end (the right in LTR, the left in RTL)
  const sign = (back ? -1 : 1) * (rtl ? -1 : 1);
  return side === "in"
    ? [{ opacity: 0, transform: `translateX(${sign * distance}px)` }, { opacity: 1, transform: "none" }]
    : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateX(${-sign * distance}px)` }];
}

const TYPES = new Set(["fade", "slide", "scale", "none"]);
export interface ResolvedTransition { type: PageTransitionType; duration: number; easing: string; distance: number }
/** The transition of a swap: the route shown decides going forward, the route left going back (so back reverses it). */
export function resolveTransition(base: PageTransitionSpec, to: Record<string, unknown> | undefined, from: Record<string, unknown> | undefined, dir: Dir): ResolvedTransition {
  const pick = (m: Record<string, unknown> | undefined): PageTransitionSpec | null => {
    const v = m?.["transition"];
    if (typeof v === "string" && TYPES.has(v)) return { type: v as PageTransitionType };
    if (v === false) return { type: "none" };
    return v && typeof v === "object" ? (v as PageTransitionSpec) : null;
  };
  const own = (dir === "back" ? pick(from) ?? pick(to) : pick(to)) ?? {};
  return {
    type: own.type ?? base.type ?? "fade",
    duration: own.duration ?? base.duration ?? defaultTiming().duration,
    easing: own.easing ?? base.easing ?? "out",
    distance: own.distance ?? base.distance ?? 32,
  };
}

// a ::view-transition-* pseudo-element as an engine target (WAAPI with `pseudoElement`; there is no JS path)
interface PseudoTarget { el: Element; pseudo: string; [DRIVER]: Driver<PseudoTarget> }
const pseudoDriver: Driver<PseudoTarget> = {
  name: "pseudo",
  supports: () => false,
  apply: () => undefined,
  native: (t, frames, timing) => {
    if (typeof t.el.animate !== "function") return null;
    try { const a = t.el.animate(frames, { ...timing, pseudoElement: t.pseudo }); a.pause(); return a; } catch { return null; }
  },
  element: (t) => t.el,
};
const pseudo = (el: Element, p: string): PseudoTarget => ({ el, pseudo: p, [DRIVER]: pseudoDriver });

const ident = (s: string): string => s.replace(/[^a-zA-Z0-9_-]/g, "_");
function sharedOf(root: ParentNode | null | undefined): Map<string, HTMLElement> {
  const m = new Map<string, HTMLElement>();
  for (const el of Array.from(root?.querySelectorAll?.<HTMLElement>("[data-hm-shared]") ?? [])) {
    const id = el.getAttribute("data-hm-shared");
    if (id && !m.has(id)) m.set(id, el);
  }
  return m;
}
function vtName(el: HTMLElement | null | undefined, name: string | null): void {
  if (!el?.style) return;
  if (name) el.style.setProperty("view-transition-name", name); else el.style.removeProperty("view-transition-name");
}
function isRtl(): boolean {
  const root = globalThis.document?.documentElement;
  if (!root) return false;
  return (root.getAttribute?.("dir") || globalThis.getComputedStyle?.(root)?.direction) === "rtl";
}

// back or forward: the history order the router keeps in history.state.hmIdx (a popstate to a lower index is "back");
// one answer per history entry, so a page and an outlet swapping in the same navigation agree
let lastIdx = 0, lastState: unknown, lastDir: Dir = "forward";
function direction(pop: boolean): Dir {
  const st = globalThis.history?.state as { hmIdx?: number } | null;
  if (st && st === lastState) return lastDir;
  const idx = typeof st?.hmIdx === "number" ? st.hmIdx : 0;
  lastDir = pop && idx < lastIdx ? "back" : "forward";
  lastIdx = idx; lastState = st;
  return lastDir;
}
/** Direction of the navigation now (for tests and custom wrappers). */
export const navDirection = (pop = true): Dir => direction(pop);

interface ViewTransitionLike { updateCallbackDone: Promise<void>; finished: Promise<void>; ready?: Promise<void> }
type StartVT = (cb: () => void) => ViewTransitionLike;

/** Turn page transitions on. Returns a function that turns them off. */
export function pageTransitions(o: PageTransitionOptions = {}): () => void {
  lastIdx = (globalThis.history?.state as { hmIdx?: number } | null)?.hmIdx ?? 0; lastState = globalThis.history?.state;
  setNavigationWrapper(async (apply: () => void, info: NavInfo) => {
    const nav = { ...info, dir: direction(info.pop) };
    const doc = globalThis.document as (Document & { startViewTransition?: StartVT }) | undefined;
    const t = resolveTransition(o, nav.to, nav.from, nav.dir);
    if (!doc || reducedNow() || pausedNow() || t.type === "none") { apply(); return; }
    const root = doc.documentElement;
    const rtl = isRtl();
    const timing = { duration: t.duration, easing: t.easing };
    // only the outlet whose content changes takes part (the shell and the layouts above it stay still)
    const pageEl = (): HTMLElement | null => (transitionOutlet()?.firstElementChild as HTMLElement | null) ?? null;

    if (o.viewTransitions !== false && typeof doc.startViewTransition === "function") {
      const old = pageEl();
      const scope = old ? "hm-page" : "root";
      const oldShared = sharedOf(old ?? doc);
      let named: HTMLElement[] = [];
      if (old) vtName(old, "hm-page");
      for (const [id, el] of oldShared) { vtName(el, `hm-shared-${ident(id)}`); named.push(el); }
      root.setAttribute("data-hm-vt", scope);
      const vt = doc.startViewTransition(() => {
        for (const el of named) vtName(el, null);
        vtName(old, null);
        apply();
        const now = pageEl();
        if (old) vtName(now, "hm-page");
        named = now ? [now] : [];
        for (const [id, el] of sharedOf(now ?? doc)) if (oldShared.has(id)) { vtName(el, `hm-shared-${ident(id)}`); named.push(el); }
      });
      const done = (): void => { for (const el of named) vtName(el, null); root.removeAttribute("data-hm-vt"); };
      // an aborted transition (resize, a second navigation) is not an error: the DOM update still happened
      void Promise.resolve(vt.ready).then(() => {
        animate(pseudo(root, `::view-transition-old(${scope})`), transitionFrames(t.type, "out", nav.dir, rtl, t.distance), timing);
        animate(pseudo(root, `::view-transition-new(${scope})`), transitionFrames(t.type, "in", nav.dir, rtl, t.distance), timing);
        // the browser's own morph of shared elements: same duration, the global speed
        for (const a of doc.getAnimations?.() ?? []) {
          const fx = a.effect as (KeyframeEffect & { pseudoElement?: string | null }) | null;
          const pe = fx?.pseudoElement ?? "";
          if (ours.has(a) || !pe.startsWith("::view-transition") || /\((root|hm-page)\)/.test(pe)) continue;
          try { fx!.updateTiming({ duration: t.duration }); a.updatePlaybackRate(rateScale()); } catch { /* already finished */ }
        }
      }, () => undefined);
      void Promise.resolve(vt.finished).catch(() => undefined).then(done);
      await Promise.resolve(vt.updateCallbackDone).catch(() => undefined);
      return;
    }

    // no View Transitions: the old page out, the swap, the new page in (and shared elements FLIP to their new place)
    const old = pageEl();
    const rects = new Map<string, DOMRect>();
    for (const [id, el] of sharedOf(old ?? doc)) if (el.getBoundingClientRect) rects.set(id, el.getBoundingClientRect());
    if (old) await animate(old, transitionFrames(t.type, "out", nav.dir, rtl, t.distance), { duration: t.duration * 0.4, easing: "in" }).finished;
    apply();
    const now = pageEl() ?? (o.target ? doc.querySelector<HTMLElement>(o.target) : null) ?? doc.querySelector<HTMLElement>("main");
    if (now) animate(now, transitionFrames(t.type, "in", nav.dir, rtl, t.distance), { ...timing, duration: t.duration * 0.6 });
    for (const [id, el] of sharedOf(now)) flipFrom(el, rects.get(id), t.duration, t.easing);
  });

  void outlets((name, apply, { to, from }) => {
    // a modal opened or closed by a history move: popstate already ran, so pop=true reads the order right
    const dir = direction(true);
    const t = resolveTransition(o, to?.meta, from?.meta, dir);
    // the modal's dialog opens and closes itself: only a swap inside it animates here
    if (reducedNow() || pausedNow() || t.type === "none" || !to || (name === "modal" && !from)) { apply(); return; }
    const doc = globalThis.document;
    const sel = `[data-outlet-page="${name}"]`;
    const rects = new Map<string, DOMRect>();
    for (const [id, el] of sharedOf(doc?.querySelector(sel))) if (el.getBoundingClientRect) rects.set(id, el.getBoundingClientRect());
    apply();
    const el = doc?.querySelector<HTMLElement>(sel);
    if (!el) return;
    animate(el, transitionFrames(t.type, "in", dir, isRtl(), t.distance), { duration: t.duration * 0.8, easing: t.easing });
    for (const [id, s] of sharedOf(el)) flipFrom(s, rects.get(id), t.duration, t.easing);
  });

  return () => { setNavigationWrapper(null); void outlets(null); };
}

/** FLIP: an element that was at `from` moves (and scales) from there to where it is now. */
function flipFrom(el: HTMLElement, from: DOMRect | undefined, duration: number, easing: string): void {
  if (!from || !el.getBoundingClientRect) return;
  const to = el.getBoundingClientRect();
  if (!to.width || !to.height) return;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const sx = from.width / to.width, sy = from.height / to.height;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;
  animate(el, [{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transform: "none" }], { duration, easing });
}
