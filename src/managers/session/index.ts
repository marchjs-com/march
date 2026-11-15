// SessionManager: how long the signed-in session lasts, a warning before it ends, extension on activity, and the same
// deadline in every tab (localStorage): extending in one tab extends all, signing out in one ends all.
//
//   import { session, configureSession } from "march/managers/session";
//   configureSession({ duration: 30 * 60_000, warnBefore: 2 * 60_000, onExpire: () => signOut() });
//   session().start()      session().remaining()  session().warning()      // reactive, ticks every second
//   <Dialog open={session().warning}>… <Button on:click={() => session().extend()}>Stay signed in</Button>
//
// Events: session:start, session:extend ({ expiresAt }), session:warn ({ remaining }), session:expire, session:end.
import { signal, computed, effect, onCleanup, untrack } from "../../core/reactive.ts";
import { defineManager, emit } from "../manager.ts";
import { idle } from "../idle/index.ts";

export interface SessionConfig {
  /** Session length in ms. Default 30 minutes. */
  duration: number;
  /** warning() turns true this long before the end. Default 2 minutes. */
  warnBefore: number;
  /** User activity (IdleManager) extends the session — but not during the warning, which needs extend(). Default true. */
  extendOnActivity: boolean;
  /** Activity extends at most once per this many ms. Default 30 000. */
  extendEvery: number;
  /** localStorage key shared by the tabs (null = this tab only). */
  storageKey: string | null;
  /** Called once when the session runs out (sign out, redirect). */
  onExpire: (() => void) | null;
}

export interface Session {
  /** A session is running (started, not ended or expired). */
  active(): boolean;
  /** Deadline in ms since epoch (reactive). */
  expiresAt(): number | null;
  /** ms left (reactive, updates every second while active). */
  remaining(): number;
  /** Inside the warning window. */
  warning(): boolean;
  /** Ran out (until the next start()). */
  expired(): boolean;
  start(duration?: number): void;
  /** Push the deadline to now + duration. */
  extend(): void;
  /** Sign out: ends the session here and in the other tabs. */
  end(): void;
  dispose(): void;
}

const DEFAULTS: SessionConfig = { duration: 30 * 60_000, warnBefore: 2 * 60_000, extendOnActivity: true, extendEvery: 30_000, storageKey: "m.session", onExpire: null };

type Stored = { exp: number | null; dur: number };

function create(cfg: SessionConfig): Session {
  const ls = ((): Storage | null => { try { return cfg.storageKey ? globalThis.localStorage ?? null : null; } catch { return null; } })();
  const exp = signal<number | null>(null, { name: "session.expiresAt" });
  const now = signal(Date.now(), { name: "session.now" });
  const expired = signal(false, { name: "session.expired" });
  let dur = cfg.duration;
  let tick: ReturnType<typeof setInterval> | null = null;
  let warned = false, lastExtend = 0;

  const remaining = computed(() => { const e = exp(); return e === null ? 0 : Math.max(0, e - now()); });
  const warning = computed(() => exp() !== null && remaining() > 0 && remaining() <= cfg.warnBefore);

  const write = (): void => { try { ls?.setItem(cfg.storageKey!, JSON.stringify({ exp: exp.peek(), dur } satisfies Stored)); } catch { /* blocked */ } };
  const check = (): void => {
    const e = exp.peek();
    const t = Date.now();
    now.set(t);
    if (e === null) return;
    const left = e - t;
    if (left <= 0) {
      stopTick();
      exp.set(null);
      expired.set(true);
      warned = false;
      write();
      emit("session", "expire");
      try { cfg.onExpire?.(); } catch (err) { console.error(err); }
      return;
    }
    if (left <= cfg.warnBefore && !warned) { warned = true; emit("session", "warn", { remaining: left }); }
    if (left > cfg.warnBefore) warned = false;
  };
  const startTick = (): void => { if (!tick) tick = setInterval(check, 1000); };
  const stopTick = (): void => { if (tick) clearInterval(tick); tick = null; };
  const setExp = (e: number | null, share: boolean): void => {
    exp.set(e);
    if (e !== null) { expired.set(false); startTick(); } else stopTick();
    if (share) write();
    check();
  };

  const start = (d?: number): void => {
    if (d !== undefined) dur = d;
    lastExtend = Date.now();
    setExp(Date.now() + dur, true);
    emit("session", "start", { expiresAt: exp.peek() });
  };
  const extend = (): void => {
    if (exp.peek() === null) return;
    lastExtend = Date.now();
    setExp(Date.now() + dur, true);
    emit("session", "extend", { expiresAt: exp.peek() });
  };

  // another tab extended, started or ended the session
  const onStorage = (e: StorageEvent): void => {
    if (e.key !== cfg.storageKey) return;
    let s: Stored | null = null;
    try { s = e.newValue ? JSON.parse(e.newValue) as Stored : null; } catch { return; }
    const had = exp.peek() !== null;
    if (s?.dur) dur = s.dur;
    setExp(s?.exp ?? null, false);
    if (had && exp.peek() === null && !expired.peek()) emit("session", "end", { from: "tab" });
  };
  const win = globalThis as unknown as EventTarget;
  win.addEventListener?.("storage", onStorage as EventListener);
  // pick up a session another tab started before this one loaded
  try { const s = JSON.parse(ls?.getItem(cfg.storageKey!) ?? "null") as Stored | null; if (s?.exp && s.exp > Date.now()) { dur = s.dur || dur; setExp(s.exp, false); } } catch { /* ignore */ }

  // through an effect: a re-configured IdleManager (new instance) is followed
  const offActivity = cfg.extendOnActivity ? effect(() => {
    onCleanup(idle().onActivity(() => {
      if (exp.peek() === null || untrack(warning) || Date.now() - lastExtend < cfg.extendEvery) return;
      extend();
    }));
  }) : null;

  return {
    active: () => exp() !== null,
    expiresAt: exp,
    remaining,
    warning,
    expired,
    start,
    extend,
    end() {
      if (exp.peek() === null) return;
      warned = false;
      setExp(null, true);
      emit("session", "end");
    },
    dispose() {
      stopTick();
      offActivity?.();
      win.removeEventListener?.("storage", onStorage as EventListener);
    },
  };
}

const manager = defineManager<Session, SessionConfig>("session", create, DEFAULTS);
/** The session manager (created on first call; nothing runs until start()). */
export const session = (): Session => manager.get();
/** Set the session manager's options (merged into the current config). */
export const configureSession = (config: Partial<SessionConfig>): void => manager.configure(config);
/** Stop the session manager and remove its listeners; the next call starts it again. */
export const disposeSession = (): void => manager.dispose();
/** The session manager (get, configure, dispose). */
export const sessionManager = manager;
