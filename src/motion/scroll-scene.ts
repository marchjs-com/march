// Scroll scenes: scroll-linked effects (parallax layers, pinned stories, horizontal sections, progress bars, colour
// changes) share ONE passive scroll / resize listener. On a scroll the engine clock runs one frame: every visible scene
// is measured in the read phase, then written in the write phase (no layout thrashing). Scenes off screen are skipped.
// Scroll is user input, not time: scenes follow the scroll even while motion is paused; with reduced motion each scene
// decides (most stop moving and show their resting state).
//   const stop = scrollScene(el, ({ progress, pin }) => el.style.setProperty("--p", String(progress)))
import { onCleanup, getOwner } from "../core/reactive.ts";
import { measure, mutate } from "./engine/clock.ts";
import { watchVisibility, isVisible } from "./engine/visibility.ts";
import { clamp } from "../core/util.ts";

export interface SceneState {
  /** 0 when the element's top enters at the bottom of the viewport, 1 when its bottom leaves at the top. */
  progress: number;
  /** For tall (sticky) sections: 0 when its top reaches the viewport top, 1 when its bottom reaches the viewport bottom. */
  pin: number;
  /** Element box relative to the viewport. */
  top: number; height: number;
  /** Viewport size. */
  vw: number; vh: number;
  /** Page scroll position and its 0–1 progress. */
  scrollY: number; page: number;
}
export type SceneFn = (s: SceneState) => void;

interface Scene { el: Element | null; fn: SceneFn; state: SceneState | null }
const scenes = /* @__PURE__ */ new Set<Scene>();
let queued = false, listening = false;

const read = (): void => {
  const vh = globalThis.innerHeight || 1, vw = globalThis.innerWidth || 1;
  const y = globalThis.scrollY ?? 0;
  const max = Math.max(0, (globalThis.document?.documentElement?.scrollHeight ?? 0) - vh);
  const page = max > 0 ? clamp(y / max, 0, 1) : 0;
  for (const s of scenes) {
    if (s.el && !isVisible(s.el)) { s.state = null; continue; }
    const r = s.el?.getBoundingClientRect();
    const top = r?.top ?? -y, height = r?.height ?? max + vh;
    s.state = {
      progress: s.el ? clamp((vh - top) / (height + vh), 0, 1) : page,
      pin: s.el ? (height > vh ? clamp(-top / (height - vh), 0, 1) : clamp((vh - top) / (height + vh), 0, 1)) : page,
      top, height, vw, vh, scrollY: y, page,
    };
  }
};
const write = (): void => { queued = false; for (const s of scenes) if (s.state) s.fn(s.state); };
const schedule = (): void => { if (queued) return; queued = true; measure(read); mutate(write); };

function listen(on: boolean): void {
  if (on === listening) return;
  listening = on;
  const m = on ? "addEventListener" : "removeEventListener";
  globalThis[m]?.("scroll", schedule, { passive: true } as never);
  globalThis[m]?.("resize", schedule, { passive: true } as never);
}

/**
 * Call `fn` with the scroll state of `el` (or of the page when `el` is null) on every scroll / resize frame while
 * `el` is on screen, and once at start. Returns stop; also stops with the current owner.
 */
export function scrollScene(el: Element | null, fn: SceneFn): () => void {
  const s: Scene = { el, fn, state: null };
  scenes.add(s);
  listen(true);
  const unwatch = el ? watchVisibility(el, (v) => { if (v) schedule(); }) : () => {};
  schedule();
  const stop = (): void => { scenes.delete(s); unwatch(); if (!scenes.size) listen(false); };
  if (getOwner()) onCleanup(stop);
  return stop;
}

/** Measure all scenes again on the next frame (after a layout change that did not scroll). */
export const refreshScenes = (): void => schedule();
