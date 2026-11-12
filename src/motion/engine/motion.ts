// `motion`: the global switchboard for every animation (engine playbacks, springs, canvas / WebGL scenes and plain
// CSS animations alike), and defineMotion() to extend the engine with keyframes, easings, presets and characters.
//   motion.config({ speed: 0.5 })   motion.pauseAll()   motion.resumeAll()   motion.config({ reduce: "reduce" })
//   motion.config({ slowMo: 0.1 })  (debug)            motion.config({ character: "calm" })   (themes)
import { configure, settings, settingsNow, resetSettings, isPaused, pausedNow, setPaused, CHARACTERS, type Character, type MotionSettings } from "./config.ts";
import { reducedMotion, reducedNow } from "./prefs.ts";
import { installCssControl } from "./css-control.ts";
import { defineEasing, type EaseInput } from "./ease.ts";
import { keyframes, preset, type Timing } from "./keyframes.ts";
import type { Frames } from "./tracks.ts";

installCssControl();

export const motion = {
  /** Read (no argument) or change the global settings; changes are saved. */
  config: (patch?: Partial<MotionSettings>, o?: { persist?: boolean }): MotionSettings => (patch ? configure(patch, o) : settingsNow()),
  /** Reactive settings. */
  settings,
  /** Back to the defaults. */
  reset: resetSettings,
  /** Reactive: true while everything is paused. */
  paused: isPaused,
  /** Reactive: true while reduced motion is on (system or setting). */
  reduced: reducedMotion,
  /** Pause every animation: engine playbacks, springs, canvas / WebGL scenes, CSS animations and transitions. */
  pauseAll(): void { setPaused(true); },
  resumeAll(): void { setPaused(false); },
  togglePause(): boolean { setPaused(!pausedNow()); return pausedNow(); },
  /** Untracked reads for hot paths. */
  now: { paused: pausedNow, reduced: reducedNow },
};

export interface MotionExtension {
  keyframes?: Record<string, Frames | { frames: Frames; defaults?: Timing }>;
  easings?: Record<string, EaseInput>;
  presets?: Record<string, { use: string } & Timing>;
  /** Motion characters a theme can pick (`motion.config({ character: "calm" })`). */
  characters?: Record<string, Character>;
}
/** Extend the engine: keyframes, easings, presets and characters, all usable by name everywhere. */
export function defineMotion(ext: MotionExtension): void {
  for (const [k, v] of Object.entries(ext.easings ?? {})) defineEasing(k, v);
  for (const [k, v] of Object.entries(ext.keyframes ?? {})) {
    if (v && !Array.isArray(v) && "frames" in v && typeof v.frames === "object") keyframes(k, v.frames as Frames, (v.defaults ?? {}) as Timing);
    else keyframes(k, v as Frames);
  }
  for (const [k, v] of Object.entries(ext.presets ?? {})) { const { use, ...t } = v; preset(k, use, t); }
  for (const [k, v] of Object.entries(ext.characters ?? {})) CHARACTERS[k] = v;
}

interface VT { finished: Promise<void>; ready: Promise<void>; updateCallbackDone: Promise<void>; skipTransition?: () => void }
/**
 * Run a DOM update as a View Transition where supported (the browser animates old → new snapshots on the
 * compositor); without support, with reduced motion or while paused, the update simply runs.
 */
export async function viewTransition(update: () => void | Promise<void>): Promise<void> {
  const doc = globalThis.document as Document & { startViewTransition?: (cb: () => void | Promise<void>) => VT };
  if (!doc?.startViewTransition || reducedNow() || pausedNow()) { await update(); return; }
  const vt = doc.startViewTransition(update);
  vt.ready.catch(() => undefined);
  await vt.updateCallbackDone.catch(() => undefined);
  await vt.finished.catch(() => undefined);
}
