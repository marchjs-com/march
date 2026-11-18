// Playback: the one animation object. animate() returns one, timeline() builds one; both have the same controls
// (play, pause, reverse, seek, finish, cancel, playbackRate, currentTime, finished, progress).
// Every effect inside chooses its path once:
//   native — a WAAPI Animation (DOM / CSS variables with CSS-expressible values and easings): runs on the compositor,
//            keeps going while the main thread is busy. The playback only sets its time, rate and play state.
//   JS     — sampled on the shared clock (objects, canvas, WebGL, vectors, custom JS easings, no WAAPI).
// Native and JS effects in one timeline share one time, so a DOM card, a canvas and a WebGL uniform stay in step.
import { signal } from "../../core/reactive.ts";
import { onFrame, nextFrame } from "./clock.ts";
import { defaultTiming, rateScale, pausedNow, onConfig } from "./config.ts";
import { reducedNow } from "./prefs.ts";
import { ease, cssOf, type Ease, type EaseInput } from "./ease.ts";
import { normalize, nativeFrames, Track, type Frames, type RawTrack } from "./tracks.ts";
import { driverFor, type Driver } from "./drivers.ts";
import { getKeyframes, type KeyframesDef, type Timing } from "./keyframes.ts";
import { isVisible, watchVisibility } from "./visibility.ts";
import { ours, setRate } from "./native.ts";
import { clamp } from "../../core/util.ts";

export type { Timing };
export type Target = unknown;
export type KeyframesInput = Frames | string | KeyframesDef;
export type StaggerFn = (i: number, total: number) => number;

export interface AnimateOptions extends Timing {
  /** Delay between targets (ms) or stagger(…). */
  stagger?: number | StaggerFn;
  /** Keep running with reduced motion (progress indicators). Others jump to their end state. */
  essential?: boolean;
  /** Start right away (default true for animate(), false for timeline()). */
  autoplay?: boolean;
  /** Force the JS path (sampled on the clock) even where WAAPI could run it. */
  js?: boolean;
  /** Root for selector targets. */
  root?: ParentNode;
  /** Called every frame while it runs (after values are written). */
  onUpdate?: (progress: number, time: number) => void;
  onComplete?: () => void;
}
export interface StepOptions extends AnimateOptions {
  /** Start: ms, "+=100" / "-=100" after the previous end, "<" with the previous start ("<+=50"), ">" at the previous end, a label, "label+=100". */
  at?: number | string;
}

/** Stagger delays: `stagger(40, { from: "center" })`, grids (`grid: [cols, rows]`), eased spreading. */
export function stagger(each = 40, o: { from?: "start" | "end" | "center" | "edges" | number; total?: number; grid?: [number, number]; ease?: EaseInput; start?: number } = {}): StaggerFn {
  const e = o.ease ? ease(o.ease) : null;
  return (i: number, total?: number) => {
    const n = o.total ?? total ?? 0;
    const from = o.from ?? "start";
    let d: number, max: number;
    if (o.grid) {
      const [cols, rows] = o.grid;
      const ox = from === "center" ? (cols - 1) / 2 : from === "end" ? cols - 1 : typeof from === "number" ? from % cols : 0;
      const oy = from === "center" ? (rows - 1) / 2 : from === "end" ? rows - 1 : typeof from === "number" ? Math.floor(from / cols) : 0;
      d = Math.hypot((i % cols) - ox, Math.floor(i / cols) - oy);
      max = Math.hypot(Math.max(ox, cols - 1 - ox), Math.max(oy, rows - 1 - oy));
    } else {
      const origin = from === "start" ? 0 : from === "end" ? Math.max(0, n - 1) : from === "center" ? (n - 1) / 2 : from === "edges" ? -1 : from;
      d = from === "edges" ? Math.min(i, Math.max(0, n - 1 - i)) : Math.abs(i - origin);
      max = from === "edges" ? Math.floor((n - 1) / 2) : Math.max(origin, n - 1 - origin);
    }
    const spread = e && max > 0 ? e(d / max) * max : d;
    return (o.start ?? 0) + spread * each;
  };
}

const finite = (n: number): number => (Number.isFinite(n) ? n : 0);

/** One target × its tracks with timing: the unit both paths play. */
export class Effect {
  /** The driver that reads and writes the animated target. */
  readonly driver: Driver;
  /** The normalized keyframe tracks before they are compiled. */
  readonly raw: RawTrack[];
  /** The names of the properties this effect animates. */
  readonly props: string[];
  /** Milliseconds to wait before the effect starts. */
  readonly delay: number;
  /** Milliseconds one iteration takes. */
  readonly duration: number;
  /** How many times the effect repeats (Infinity for endless). */
  readonly iterations: number;
  /** Milliseconds to hold after the last iteration before the effect ends. */
  readonly endDelay: number;
  /** Whether iterations play forward, backward or alternate. */
  readonly direction: PlaybackDirection;
  /** Which values the effect keeps applying before it starts and after it ends. */
  readonly fill: FillMode;
  /** The easing applied to each iteration's progress. */
  readonly ease: Ease;
  /** Absolute start inside the root playback (set when the root collects its effects). */
  start = 0;
  /** The native browser animation, once created. */
  native: Animation | null = null;
  /** The compiled JS tracks, once created. */
  tracks: Track[] | null = null;
  /** True when the effect runs as a native animation instead of the JS path. */
  readonly useNative: boolean;
  #nativeFrames: Keyframe[] | null = null;
  #wasVisible = true;
  #unwatch: (() => void) | null = null;
  /** The object being animated (an element, canvas, or other driver target). */
  readonly target: unknown;
  constructor(target: unknown, frames: Frames, t: Timing, forceJs: boolean) {
    this.target = target;
    this.driver = driverFor(target);
    this.raw = normalize(frames);
    this.props = this.raw.map((r) => r.prop);
    this.ease = ease(t.easing ?? defaultTiming().easing);
    this.duration = Math.max(0, t.duration ?? this.ease.duration ?? defaultTiming().duration);
    this.delay = t.delay ?? 0; this.endDelay = t.endDelay ?? 0;
    this.iterations = Math.max(0, t.iterations ?? 1);
    this.direction = t.direction ?? "normal"; this.fill = t.fill ?? "both";
    let ok = !forceJs && !!this.driver.native && !!cssOf(this.ease);
    if (ok) { this.#nativeFrames = nativeFrames(this.raw); ok = !!this.#nativeFrames; }
    this.useNative = ok;
  }
  /** Local end (delay + active + endDelay); Infinity for endless effects. */
  get end(): number { return this.delay + this.duration * this.iterations + this.endDelay; }

  /** Create the native animation (paused) once; null when the driver refuses (then the JS path takes over). */
  ensureNative(): Animation | null {
    if (!this.useNative || this.native) return this.native;
    const a = this.driver.native!(this.target, this.#nativeFrames!, {
      duration: this.duration, delay: this.start + this.delay, endDelay: this.endDelay, iterations: this.iterations,
      direction: this.direction, fill: this.fill, easing: cssOf(this.ease)!,
    });
    if (!a) { (this as { useNative: boolean }).useNative = false; return null; }
    ours.add(a);
    this.native = a;
    if (this.iterations === Infinity) {
      const el = this.driver.element?.(this.target);
      if (el) this.#unwatch = watchVisibility(el, (v) => { if (a.playState === "running" || a.playState === "paused") { if (v && this.liveRoot?.state === "running" && !pausedNow()) a.play(); else if (!v) a.pause(); } });
    }
    return a;
  }
  /** The running root playback this effect belongs to, if any. */
  liveRoot: Playback | null = null;

  /** Compile the JS tracks (reads implicit start / end values from the target). */
  ensureTracks(): Track[] {
    if (!this.tracks) this.tracks = this.raw.map((r) => new Track(r, () => this.driver.read?.(this.target, r.prop) ?? 0));
    return this.tracks;
  }

  /** Iteration progress (eased) at local time t, or null when the effect has no effect then (fill). */
  progressAt(t: number): number | null {
    const active = this.duration * this.iterations;
    const local = t - this.delay;
    let iter: number, p: number;
    if (local < 0) {
      if (this.fill !== "backwards" && this.fill !== "both") return null;
      iter = 0; p = 0;
    } else if (local >= active) {
      if (this.fill !== "forwards" && this.fill !== "both") return null;
      if (!Number.isFinite(active)) return null;
      const whole = this.iterations;
      p = whole % 1 || 1; iter = Math.ceil(whole) - 1;
      if (this.duration === 0) { p = 1; iter = Math.max(0, Math.ceil(whole) - 1); }
    } else {
      iter = this.duration > 0 ? Math.floor(local / this.duration) : 0;
      p = this.duration > 0 ? (local - iter * this.duration) / this.duration : 1;
    }
    const d = this.direction;
    const rev = d === "reverse" || (d === "alternate" && iter % 2 === 1) || (d === "alternate-reverse" && iter % 2 === 0);
    if (rev) p = 1 - p;
    return this.ease(p);
  }

  /** JS path: sample and write at local time t (skipped while the target is off screen). */
  sample(t: number): void {
    const p = this.progressAt(t);
    const tracks = this.ensureTracks();
    if (p == null) { this.restore(); return; }
    const el = this.driver.element?.(this.target);
    const vis = isVisible(el);
    if (!vis && !this.#wasVisible) return;
    this.#wasVisible = vis;
    for (const tr of tracks) { tr.sample(p); this.driver.apply(this.target, tr); }
    if (this.driver.flush) { if (!dirty.size) nextFrame(flushDirty, "render"); dirty.set(this.target, this.driver); }
  }
  /** Puts the animated properties back to their original values. */
  restore(): void { if (this.driver.restore && this.tracks) for (const p of this.props) this.driver.restore(this.target, p); }
  /** Starts or stops pausing the effect while its target is off screen. */
  watch(on: boolean): void {
    const el = this.useNative ? null : this.driver.element?.(this.target);
    if (!el) return;
    if (on && !this.#unwatch) this.#unwatch = watchVisibility(el);
    else if (!on && this.#unwatch && !this.native) { this.#unwatch(); this.#unwatch = null; }
  }
  /** Cancels the native animation and stops watching the target. */
  dispose(): void { this.native?.cancel(); this.native = null; this.#unwatch?.(); this.#unwatch = null; }
}

// targets written this frame whose driver draws once per frame (canvas, WebGL)
const dirty = new Map<unknown, Driver>();
function flushDirty(): void {
  if (!dirty.size) return;
  for (const [t, d] of dirty) { try { d.flush!(t); } catch (e) { globalThis.console?.error?.(e); } }
  dirty.clear();
}

/** Native animations made by the engine (CSS control leaves them to their playback). */
export { ours };
/** Running and globally paused root playbacks. */
const live = new Set<Playback>();
onConfig((why) => {
  for (const p of live) {
    if (why === "pause") p.syncPause();
    else p.syncRate();
  }
});

interface Item { at: number; node: Effect | Playback }
type Label = number;

/** A timeline of animations with labels, play, pause, seek, reverse and speed. */
export class Playback {
  /** The effects and nested playbacks with their start positions. */
  readonly items: Item[] = [];
  /** Named time positions added with label(). */
  readonly labels = new Map<string, Label>();
  #calls: { at: number; fn: () => void }[] = [];
  /** The playback this one is nested in, or null for a root. */
  parent: Playback | null = null;
  /** Whether the playback is idle, running, paused or finished. */
  state: "idle" | "running" | "paused" | "finished" = "idle";
  /** True when the playback keeps running under reduced motion instead of jumping to its end state. */
  essential = false;
  /** Called on every update with the progress (0..1) and the current time in ms. */
  onUpdate: ((progress: number, time: number) => void) | undefined;
  /** Called once when the playback finishes. */
  onComplete: (() => void) | undefined;
  #t = 0;
  #rate = 1;
  #flat: Effect[] | null = null;
  #off: (() => void) | null = null;
  #done!: Promise<void>;
  #resolve!: () => void;
  #prog = signal(0);
  #lastStart = 0;
  #lastEnd = 0;
  #hinted = false;
  #gen = 0;

  /** The options applied to every animation added to this playback. */
  readonly defaults: AnimateOptions;
  constructor(defaults: AnimateOptions = {}) {
    this.defaults = defaults;
    this.essential = !!defaults.essential;
    this.onUpdate = defaults.onUpdate; this.onComplete = defaults.onComplete;
    this.#fresh();
  }
  #fresh(): void { this.#done = new Promise<void>((r) => { this.#resolve = r; }); }

  // ---- building
  /** Add an animation of `target` (or a nested playback) at a position. */
  add(target: Target | Playback, frames?: KeyframesInput, opts: StepOptions = {}): this {
    if (target instanceof Playback) {
      const at = this.#position(opts.at);
      target.parent = this;
      this.items.push({ at, node: target });
      this.#mark(at, at + target.duration);
      return this;
    }
    let fr: Frames, base: Timing = {};
    if (typeof frames === "string") { const d = getKeyframes(frames); if (!d) throw new Error(`motion: unknown keyframes "${frames}"`); fr = d.frames; base = d.defaults; }
    else if (frames && "frames" in frames && "name" in frames && "defaults" in frames) { fr = (frames as KeyframesDef).frames; base = (frames as KeyframesDef).defaults; }
    else fr = (frames ?? {}) as Frames;
    const o: StepOptions = { ...stripRuntime(this.defaults), ...base, ...opts };
    const list = resolveTargets(target, opts.root ?? this.defaults.root);
    const at = this.#position(opts.at);
    const st = typeof o.stagger === "function" ? o.stagger : o.stagger ? stagger(o.stagger) : null;
    let end = at;
    list.forEach((el, i) => {
      const fx = new Effect(el, fr, { ...o, delay: (o.delay ?? 0) + (st ? st(i, list.length) : 0) }, !!o.js);
      this.items.push({ at, node: fx });
      end = Math.max(end, at + finite(fx.end === Infinity ? fx.delay + fx.duration : fx.end));
    });
    this.#mark(at, end);
    return this;
  }
  /** A named position (`tl.label("intro", 400)`; default: the current end). */
  label(name: string, at?: number | string): this { this.labels.set(name, this.#position(at)); return this; }
  /** Call `fn` when playback passes `at` (either direction). */
  call(fn: () => void, at?: number | string): this { this.#calls.push({ at: this.#position(at), fn }); return this; }

  #mark(start: number, end: number): void { this.#lastStart = start; this.#lastEnd = Math.max(this.#lastEnd, end); this.#flat = null; }
  #position(at: number | string | undefined): number {
    if (typeof at === "number") return Math.max(0, at);
    if (at == null || at === ">") return this.#lastEnd;
    const m = /^(<|>)?([A-Za-z_][\w-]*)?(?:([+-])=(-?[\d.]+))?$/.exec(at.trim());
    if (!m) return this.#lastEnd;
    const [, rel, label, sign, n] = m;
    let base = this.#lastEnd;
    if (rel === "<") base = this.#lastStart;
    if (label) base = this.labels.get(label) ?? this.#lastEnd;
    const d = sign ? (sign === "+" ? 1 : -1) * Number(n) : 0;
    return Math.max(0, base + d);
  }

  // ---- reading
  /** Total length in ms (Infinity when something loops forever). */
  get duration(): number {
    let m = 0;
    for (const { at, node } of this.items) m = Math.max(m, at + (node instanceof Playback ? node.duration : node.end));
    for (const c of this.#calls) m = Math.max(m, c.at);
    return m;
  }
  /** The current position in ms; setting it seeks. */
  get currentTime(): number { return this.#t; }
  set currentTime(ms: number) { this.seek(ms); }
  /** The playback speed multiplier; setting it changes the speed immediately. */
  get playbackRate(): number { return this.#rate; }
  set playbackRate(r: number) { this.#rate = r; this.syncRate(); }
  /** Resolves when it finishes (or is cancelled). */
  get finished(): Promise<void> { return this.#done; }
  /** 0..1 (reactive). */
  progress(): number { return this.#prog(); }
  /** The first native animation (compatibility with the old Controls). */
  get animation(): Animation | null { return this.#collect().find((e) => e.native)?.native ?? null; }
  /** Await the end: `await animate(el, "fadeIn")`. */
  then<A = void, B = never>(ok?: ((v: void) => A | PromiseLike<A>) | null, err?: ((e: unknown) => B | PromiseLike<B>) | null): Promise<A | B> { return this.#done.then(ok, err); }

  #root(): Playback { let p: Playback = this; while (p.parent) p = p.parent; return p; }
  #collect(): Effect[] {
    if (this.#flat) return this.#flat;
    const out: Effect[] = [];
    const walk = (p: Playback, base: number): void => {
      for (const { at, node } of p.items) {
        if (node instanceof Playback) walk(node, base + at);
        else { node.start = base + at; out.push(node); }
      }
    };
    walk(this, 0);
    return (this.#flat = out);
  }

  // ---- controls
  /** Starts or resumes the playback from the current position. */
  play(): this {
    if (this.parent) { this.#root().play(); return this; }
    const dur = this.duration;
    if (this.state === "running") return this;
    if (this.state === "finished" || this.state === "idle") {
      if (this.state === "finished") this.#fresh();
      if (this.#rate >= 0 && this.#t >= dur) this.#t = 0;
      if (this.#rate < 0 && this.#t <= 0) this.#t = dur;
    }
    if (reducedNow() && !this.essential) {
      if (Number.isFinite(dur)) { this.seek(this.#rate >= 0 ? dur : 0); this.#complete(); }
      else { this.seek(0); this.state = "paused"; this.#resolve(); }
      return this;
    }
    this.state = "running";
    const fx = this.#collect();
    for (const e of fx) { e.liveRoot = this; e.watch(true); }
    this.#hint(true);
    this.#syncNatives(true);
    live.add(this);
    this.#sampleJs(this.#t);
    if (!this.#off) this.#off = onFrame((_, dt) => this.#tick(dt), { phase: "write" });
    // all native: the browser's own end also ends the playback (it may run ahead of the clock)
    if (fx.length && fx.every((e) => e.native)) {
      const gen = ++this.#gen;
      void Promise.all(fx.map((e) => e.native!.finished)).then(() => {
        if (gen === this.#gen && this.state === "running") { this.#t = this.#rate >= 0 ? this.duration : 0; this.#report(); this.#complete(); }
      }, () => undefined);
    }
    return this;
  }
  /** Pauses the playback at the current position. */
  pause(): this {
    if (this.parent) { this.#root().pause(); return this; }
    if (this.state === "idle") { this.seek(this.#t); }
    this.state = "paused";
    this.#stopTick();
    this.#syncNatives(false);
    this.#hint(false);
    return this;
  }
  /** Play backwards from where it is (or forwards again). */
  reverse(): this {
    if (this.parent) { this.#root().reverse(); return this; }
    this.#rate = -this.#rate;
    if (this.state === "running") this.syncRate();
    else this.play();
    return this;
  }
  /** Jump to a time (ms) or a label; keeps the play state. */
  seek(to: number | string): this {
    if (this.parent) { this.#root().seek(typeof to === "string" ? to : to + this.#offsetInRoot()); return this; }
    const dur = this.duration;
    const ms = typeof to === "string" ? this.labels.get(to) ?? 0 : to;
    const prev = this.#t;
    this.#t = clamp(ms, 0, Number.isFinite(dur) ? dur : ms);
    if (this.state === "idle" || this.state === "finished") this.state = "paused";
    this.#syncNatives(this.state === "running");
    this.#sampleJs(this.#t);
    this.#fire(prev, this.#t);
    this.#report();
    return this;
  }
  /** Jump to the end and finish. */
  finish(): this {
    if (this.parent) { this.#root().finish(); return this; }
    const d = this.duration;
    if (!Number.isFinite(d)) return this;
    this.seek(this.#rate >= 0 ? d : 0);
    this.#complete();
    return this;
  }
  /** Stop and remove every effect (elements return to their own styles). */
  cancel(): this {
    if (this.parent) { this.#root().cancel(); return this; }
    this.#stopTick();
    for (const e of this.#collect()) { e.dispose(); if (!e.useNative) e.restore(); e.watch(false); }
    this.#hint(false);
    this.#t = 0;
    this.state = "idle";
    this.#prog.set(0);
    live.delete(this);
    this.#resolve();
    this.#fresh();
    return this;
  }

  #offsetInRoot(): number {
    let o = 0, p: Playback = this;
    while (p.parent) { o += p.parent.items.find((i) => i.node === p)?.at ?? 0; p = p.parent; }
    return o;
  }
  #stopTick(): void { this.#off?.(); this.#off = null; this.#gen++; live.delete(this); }
  #tick(dt: number): void {
    const prev = this.#t, dur = this.duration;
    let t = prev + dt * this.#rate, end = false;
    if (this.#rate >= 0 && t >= dur) { t = dur; end = true; }
    if (this.#rate < 0 && t <= 0) { t = 0; end = true; }
    this.#t = t;
    this.#sampleJs(t);
    this.#fire(prev, t);
    this.#report();
    if (end) this.#complete();
  }
  #report(): void {
    const d = this.duration;
    const p = Number.isFinite(d) ? (d > 0 ? this.#t / d : 1) : 0;
    this.#prog.set(p);
    this.onUpdate?.(p, this.#t);
  }
  #fire(a: number, b: number): void {
    if (a === b || !this.#calls.length) return;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    for (const c of this.#calls) if (c.at > lo && c.at <= hi) c.fn();
  }
  #sampleJs(t: number): void {
    for (const e of this.#collect()) {
      if (e.native) continue;
      if (e.useNative && e.ensureNative()) continue;
      e.sample(t - e.start);
    }
  }
  #complete(): void {
    this.#stopTick();
    this.state = "finished";
    for (const e of this.#collect()) {
      // finished natives can be dropped by the browser once a newer animation replaces them (no pile-up)
      if (e.native && e.native.playState !== "finished") { try { e.native.finish(); } catch { e.native.pause(); } }
      e.watch(false);
    }
    this.#hint(false);
    this.#prog.set(this.#rate >= 0 ? 1 : 0);
    this.#resolve();
    this.onComplete?.();
  }
  #hint(on: boolean): void {
    if (on === this.#hinted) return;
    this.#hinted = on;
    for (const e of this.#collect()) (on ? e.driver.begin : e.driver.end)?.(e.target, e.props);
  }

  /** Put every native animation at this playback's time, rate and play state. */
  #syncNatives(running: boolean): void {
    const rate = this.#rate * rateScale();
    for (const e of this.#collect()) {
      let a = e.native ?? e.ensureNative();
      if (a && a.replaceState === "removed") { a.cancel(); e.native = null; a = e.ensureNative(); }
      if (!a) continue;
      try {
        a.playbackRate = rate;
        a.currentTime = this.#t;
        if (running && !pausedNow()) a.play(); else a.pause();
      } catch { /* detached element: ignore */ }
    }
  }
  /** Global speed or own rate changed. */
  syncRate(): void {
    const rate = this.#rate * rateScale();
    for (const e of this.#collect()) if (e.native) setRate(e.native, rate);
  }
  /** Global pause changed. */
  syncPause(): void { if (this.state === "running") this.#syncNatives(true); }
}

const RUNTIME = ["at", "autoplay", "onUpdate", "onComplete", "root", "stagger"] as const;
function stripRuntime(o: AnimateOptions): AnimateOptions {
  const c: Record<string, unknown> = { ...o };
  for (const k of RUNTIME) delete c[k];
  return c as AnimateOptions;
}

/** Elements for a target: selector, element, list; any other value is one target (object, canvas, WebGL…). */
export function resolveTargets(t: unknown, root?: ParentNode): unknown[] {
  if (typeof t === "string") return [...(root ?? globalThis.document).querySelectorAll(t)];
  if (Array.isArray(t)) return t;
  if (t && typeof t === "object" && typeof (t as NodeList).length === "number" && typeof (t as NodeList).item === "function") return [...(t as NodeList)];
  return [t];
}

/** Animate any target: elements (WAAPI), CSS variables, objects, canvas, WebGL. Plays at once unless `autoplay: false`. */
export function animate(target: Target, frames: KeyframesInput, opts: AnimateOptions = {}): Playback {
  const p = new Playback(opts);
  p.add(target, frames, { ...opts, at: 0 });
  if (opts.autoplay !== false) p.play();
  return p;
}

/** A timeline: add steps (`at`, labels, stagger), then control them as one. Paused until play(). */
export function timeline(opts: AnimateOptions & { defaults?: AnimateOptions } = {}): Playback {
  const { defaults, ...rest } = opts;
  const p = new Playback({ ...defaults, ...rest });
  if (opts.autoplay) queueMicrotask(() => p.play());
  return p;
}
