// CSS animations and transitions under the same control: getAnimations() finds them (CSSAnimation / CSSTransition),
// so the global speed, pause and reduced motion reach plain CSS too — `.spinner { animation: spin 1s infinite }` slows
// down with the speed slider and stops with "Stop all".
//   cssAnimations(panel).pause()   cssAnimations().rate(0.5)   cssAnimations(dialog).finish()
import { onConfig, rateScale, pausedNow } from "./config.ts";
import { reducedNow } from "./prefs.ts";
import { ours } from "./playback.ts";

export interface CssControls {
  /** The CSS animations and transitions found (not the engine's own). */
  readonly animations: Animation[];
  pause(): void;
  play(): void;
  /** Jump to the end (endless ones are left alone). */
  finish(): void;
  cancel(): void;
  /** Set the playback rate (multiplied by the global speed). */
  rate(r: number): void;
}

const base = new WeakMap<Animation, number>();
const pausedByUs = new Set<Animation>();

function find(root: Element | Document | undefined): Animation[] {
  const r = root ?? globalThis.document;
  if (!r) return [];
  const list = r === globalThis.document ? (r as Document).getAnimations?.() : (r as Element).getAnimations?.({ subtree: true });
  return (list ?? []).filter((a) => !ours.has(a));
}

/** Control the CSS animations and transitions under `root` (default: the whole document). */
export function cssAnimations(root?: Element | Document): CssControls {
  const list = find(root);
  return {
    animations: list,
    pause: () => list.forEach((a) => a.pause()),
    play: () => list.forEach((a) => a.play()),
    finish: () => list.forEach((a) => { try { a.finish(); } catch { /* endless */ } }),
    cancel: () => list.forEach((a) => a.cancel()),
    rate: (r) => list.forEach((a) => { base.set(a, r); a.updatePlaybackRate(r * rateScale()); }),
  };
}

/** Apply the global settings to one CSS animation (speed, pause, reduced motion). */
function adopt(a: Animation): void {
  if (ours.has(a)) return;
  if (!base.has(a)) base.set(a, a.playbackRate || 1);
  const r = base.get(a)! * rateScale();
  if (a.playbackRate !== r) { try { a.updatePlaybackRate(r); } catch { a.playbackRate = r; } }
  if (pausedNow() && a.playState === "running") { a.pause(); pausedByUs.add(a); }
  if (reducedNow()) {
    const t = a.effect?.getTiming?.();
    if (t && t.iterations !== Infinity) { try { a.finish(); } catch { /* ignore */ } }
  }
}

let installed = false;
/** Let the global motion settings reach CSS animations and transitions (also the ones that start later). */
export function installCssControl(): void {
  if (installed || !globalThis.document?.getAnimations) return;
  installed = true;
  const doc = globalThis.document;
  const onStart = (e: Event): void => {
    const el = e.target as Element | null;
    for (const a of el?.getAnimations?.() ?? []) adopt(a);
  };
  doc.addEventListener("animationstart", onStart, true);
  doc.addEventListener("transitionrun", onStart, true);
  onConfig((why) => {
    if (why === "pause") {
      if (pausedNow()) for (const a of find(doc)) { if (a.playState === "running") { a.pause(); pausedByUs.add(a); } }
      else { for (const a of pausedByUs) { try { a.play(); } catch { /* gone */ } } pausedByUs.clear(); }
      return;
    }
    for (const a of find(doc)) adopt(a);
  });
  for (const a of find(doc)) adopt(a);
}
