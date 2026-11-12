// Global motion settings: speed, pause, reduced mode, default duration and easing, slow motion, character.
// Saved in localStorage (a preference, not a secret) so the user's choice survives reloads.
import { signal } from "../../core/reactive.ts";
import { setReducedOverride } from "./prefs.ts";

export type ReduceMode = "system" | "reduce" | "full";
export interface MotionSettings {
  /** Global speed multiplier (1 = normal, 0.5 = half speed). */
  speed: number;
  /** "system" follows prefers-reduced-motion; "reduce" / "full" override it. */
  reduce: ReduceMode;
  /** Default duration in ms when an animation gives none. */
  duration: number;
  /** Default easing (name, token or CSS easing). */
  easing: string;
  /** Debug slow motion factor (1 = off, 0.1 = ten times slower). */
  slowMo: number;
  /** Motion character: "default", "calm", "lively" or one added with defineMotion(). */
  character: string;
}
/** A motion character scales durations and picks the default easing ("calm" is slower and softer, "lively" springier). */
export interface Character { durationScale?: number; easing?: string }

export const DEFAULTS: MotionSettings = { speed: 1, reduce: "system", duration: 240, easing: "out", slowMo: 1, character: "default" };
export const CHARACTERS: Record<string, Character> = {
  default: {},
  calm: { durationScale: 1.35, easing: "in-out" },
  lively: { durationScale: 0.85, easing: "spring-snappy" },
};
const KEY = "hm-motion";

const num = (v: unknown, d: number, min: number, max: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
function clean(raw: Partial<MotionSettings>, base: MotionSettings): MotionSettings {
  return {
    speed: num(raw.speed, base.speed, 0.01, 20),
    reduce: raw.reduce === "reduce" || raw.reduce === "full" || raw.reduce === "system" ? raw.reduce : base.reduce,
    duration: num(raw.duration, base.duration, 0, 60_000),
    easing: typeof raw.easing === "string" && raw.easing ? raw.easing : base.easing,
    slowMo: num(raw.slowMo, base.slowMo, 0.01, 1),
    character: typeof raw.character === "string" && raw.character ? raw.character : base.character,
  };
}
function load(): MotionSettings {
  try { const s = globalThis.localStorage?.getItem(KEY); if (s) return clean(JSON.parse(s) as Partial<MotionSettings>, DEFAULTS); } catch { /* private mode */ }
  return { ...DEFAULTS };
}

let cur = load();
let pausedFlag = false;
const settingsSig = signal<MotionSettings>(cur);
const pausedSig = signal(false);
const listeners = new Set<(why: "settings" | "pause") => void>();
setReducedOverride(cur.reduce === "system" ? null : cur.reduce === "reduce");

/** Current settings (reactive). */
export const settings = (): MotionSettings => settingsSig();
export const settingsNow = (): MotionSettings => cur;
/** Change settings; saved unless `persist: false`. Returns the new settings. */
export function configure(patch: Partial<MotionSettings> = {}, { persist = true }: { persist?: boolean } = {}): MotionSettings {
  if (!Object.keys(patch).length) return cur;
  cur = clean(patch, cur);
  settingsSig.set(cur);
  setReducedOverride(cur.reduce === "system" ? null : cur.reduce === "reduce");
  if (persist) { try { globalThis.localStorage?.setItem(KEY, JSON.stringify(cur)); } catch { /* full or blocked */ } }
  emit("settings");
  return cur;
}
/** Back to the defaults (and forget the saved settings). */
export function resetSettings(): MotionSettings {
  try { globalThis.localStorage?.removeItem(KEY); } catch { /* blocked */ }
  return configure({ ...DEFAULTS }, { persist: false });
}

export const isPaused = (): boolean => pausedSig();
export const pausedNow = (): boolean => pausedFlag;
export function setPaused(on: boolean): void {
  if (on === pausedFlag) return;
  pausedFlag = on;
  pausedSig.set(on);
  emit("pause");
}

/** Multiplier for clock time (0 while paused). Hot path: plain reads, no signals. */
export const timeScale = (): number => (pausedFlag ? 0 : cur.speed * cur.slowMo);
/** Multiplier for native (WAAPI / CSS) playback rates; pause is applied separately. */
export const rateScale = (): number => cur.speed * cur.slowMo;
/** Default duration (ms) and easing after the character is applied. */
export function defaultTiming(): { duration: number; easing: string } {
  const ch = CHARACTERS[cur.character] ?? {};
  return { duration: cur.duration * (ch.durationScale ?? 1), easing: ch.easing && cur.easing === DEFAULTS.easing ? ch.easing : cur.easing };
}

export function onConfig(fn: (why: "settings" | "pause") => void): () => void { listeners.add(fn); return () => listeners.delete(fn); }
function emit(why: "settings" | "pause"): void { for (const fn of [...listeners]) fn(why); }
