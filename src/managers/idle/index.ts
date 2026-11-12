// IdleManager: is the user doing anything? Pointer, keyboard, wheel, touch and scroll count as activity; after
// `timeout` ms without any, idle() turns true. Session and Presence build on it.
//
//   import { idle, configureIdle } from "hadi-march/managers/idle";
//   configureIdle({ timeout: 5 * 60_000 });
//   idle().idle()                       // reactive
//   idle().onIdle(() => pauseVideo())   idle().onActive(() => refresh())   idle().onActivity(extendSession)
//
// Events: idle:idle, idle:active (detail { after: ms idle }).
import { signal } from "../../core/reactive.ts";
import { defineManager, emit } from "../manager.ts";

export interface IdleConfig {
  /** ms without activity before idle() turns true. Default 60 000. */
  timeout: number;
  /** DOM events that count as activity (on document, passive). */
  events: string[];
  /** Activity is handled at most once per this many ms. Default 250. */
  throttle: number;
  /** A hidden tab is idle at once (true) or only after the timeout (false, default). */
  hiddenIsIdle: boolean;
}

export interface Idle {
  /** No activity for `timeout` ms (reactive). */
  idle(): boolean;
  /** Time of the last activity (ms since epoch; reactive, updates at most once per `throttle`). */
  lastActive(): number;
  /** ms left before idle (not reactive; 0 when idle or paused). */
  remaining(): number;
  /** Count as activity now (e.g. a message from the server the user answered elsewhere). */
  reset(): void;
  /** Stop the timer (a video plays, a long upload runs); idle() stays false until resume(). */
  pause(): void;
  resume(): void;
  paused(): boolean;
  onIdle(fn: () => void): () => void;
  onActive(fn: (idleFor: number) => void): () => void;
  /** Every handled activity (throttled). */
  onActivity(fn: () => void): () => void;
  dispose(): void;
}

const DEFAULTS: IdleConfig = {
  timeout: 60_000,
  events: ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll", "focusin"],
  throttle: 250,
  hiddenIsIdle: false,
};

function create(cfg: IdleConfig): Idle {
  const doc = globalThis.document as (Document & EventTarget) | undefined;
  const isIdle = signal(false, { name: "idle.idle" });
  const last = signal(Date.now(), { name: "idle.lastActive" });
  const isPaused = signal(false, { name: "idle.paused" });
  const idleFns = new Set<() => void>(), activeFns = new Set<(ms: number) => void>(), activityFns = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastAt = Date.now(), idleSince = 0;

  const call = <A extends unknown[]>(fns: Set<(...a: A) => void>, ...a: A): void => { for (const f of [...fns]) { try { f(...a); } catch (e) { console.error(e); } } };
  const goIdle = (): void => {
    timer = null;
    if (isIdle.peek() || isPaused.peek()) return;
    idleSince = Date.now();
    isIdle.set(true);
    emit("idle", "idle", { after: idleSince - lastAt });
    call(idleFns);
  };
  const arm = (): void => {
    if (timer) clearTimeout(timer);
    timer = isPaused.peek() ? null : setTimeout(goIdle, Math.max(0, cfg.timeout - (Date.now() - lastAt)));
  };
  const activity = (force = false): void => {
    const now = Date.now();
    if (!force && !isIdle.peek() && now - lastAt < cfg.throttle) return;
    lastAt = now;
    last.set(now);
    if (isIdle.peek()) {
      const ms = now - idleSince;
      isIdle.set(false);
      emit("idle", "active", { after: ms });
      call(activeFns, ms);
    }
    call(activityFns);
    arm();
  };
  const onEvent = (): void => activity();
  const onVisibility = (): void => {
    if (doc?.visibilityState === "hidden") { if (cfg.hiddenIsIdle) goIdle(); }
    else activity(true);
  };
  for (const t of cfg.events) doc?.addEventListener(t, onEvent, { passive: true, capture: true });
  doc?.addEventListener("visibilitychange", onVisibility);
  arm();

  const sub = <F>(set: Set<F>, fn: F): (() => void) => { set.add(fn); return () => { set.delete(fn); }; };
  return {
    idle: isIdle,
    lastActive: last,
    remaining: () => (isIdle.peek() || isPaused.peek() ? 0 : Math.max(0, cfg.timeout - (Date.now() - lastAt))),
    reset: () => activity(true),
    pause: () => { if (isPaused.peek()) return; isPaused.set(true); if (timer) clearTimeout(timer); timer = null; if (isIdle.peek()) activity(true); },
    resume: () => { if (!isPaused.peek()) return; isPaused.set(false); lastAt = Date.now(); last.set(lastAt); arm(); },
    paused: isPaused,
    onIdle: (fn) => sub(idleFns, fn),
    onActive: (fn) => sub(activeFns, fn),
    onActivity: (fn) => sub(activityFns, fn),
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
      for (const t of cfg.events) doc?.removeEventListener(t, onEvent, { capture: true });
      doc?.removeEventListener("visibilitychange", onVisibility);
      idleFns.clear(); activeFns.clear(); activityFns.clear();
    },
  };
}

const manager = defineManager<Idle, IdleConfig>("idle", create, DEFAULTS);
/** The idle manager (created on first call). */
export const idle = (): Idle => manager.get();
/** Set the idle manager's options (merged into the current config). */
export const configureIdle = (config: Partial<IdleConfig>): void => manager.configure(config);
/** Stop the idle manager and remove its listeners; the next call starts it again. */
export const disposeIdle = (): void => manager.dispose();
/** The idle manager (get, configure, dispose). */
export const idleManager = manager;
