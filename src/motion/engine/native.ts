// Native animations (WAAPI, CSS animations and transitions) under the global control: speed, pause, reduced motion.
// Small on purpose: components that need a raw Animation (marquee, the OTP pop) start it through env.animateEl(), which
// adopts it here, without pulling the whole playback layer into their bundle.
import { onConfig, rateScale, pausedNow } from "./config.ts";
import { reducedNow } from "./prefs.ts";

/** Native animations made by the engine's own playbacks (they follow the global settings by themselves). */
export const ours = new WeakSet<Animation>();
/** The rate an animation asked for (before the global speed). */
export const baseRate = new WeakMap<Animation, number>();
/** Paused by "pause all"; played again on resume. */
export const pausedByUs = new Set<Animation>();

/** Apply the global settings to one native animation (speed, pause, reduced motion). */
export function adopt(a: Animation): void {
  if (ours.has(a)) return;
  if (!baseRate.has(a)) baseRate.set(a, a.playbackRate || 1);
  const r = baseRate.get(a)! * rateScale();
  if (a.playbackRate !== r) { try { a.updatePlaybackRate(r); } catch { a.playbackRate = r; } }
  if (pausedNow() && a.playState === "running") { a.pause(); pausedByUs.add(a); }
  if (reducedNow()) {
    const t = a.effect?.getTiming?.();
    if (t && t.iterations !== Infinity) { try { a.finish(); } catch { /* ignore */ } }
  }
}

// animations started through env.animateEl(): followed until they end
const started = new Set<Animation>();
/** Start a native animation under the global control (null where WAAPI is missing). */
export function startNative(el: Element, frames: Keyframe[] | PropertyIndexedKeyframes, opts: KeyframeAnimationOptions): Animation | null {
  if (typeof (el as HTMLElement).animate !== "function") return null;
  const a = (el as HTMLElement).animate(frames, opts);
  started.add(a);
  const drop = (): void => { started.delete(a); pausedByUs.delete(a); };
  a.addEventListener?.("finish", drop);
  a.addEventListener?.("cancel", drop);
  adopt(a);
  return a;
}
onConfig((why) => {
  if (why === "pause") {
    if (pausedNow()) { for (const a of started) if (a.playState === "running") { a.pause(); pausedByUs.add(a); } }
    else for (const a of started) if (pausedByUs.delete(a)) { try { a.play(); } catch { /* gone */ } }
    return;
  }
  for (const a of started) adopt(a);
});
