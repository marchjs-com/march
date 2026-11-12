// RateLimitManager: throttle, debounce and quotas in one place, with reactive state (pending, remaining, reset time)
// and cleanup with the component. Quotas are shared by key across the app (e.g. "search" or "api:/export").
//
//   import { rateLimit } from "hadi-march/managers/rate";
//   const r = rateLimit();
//   const save = r.debounce(() => api.save(doc), 500, { maxWait: 3000 });   save()  save.flush()  save.pending()
//   const onScroll = r.throttle(update, 100);                                // leading + trailing
//   const q = r.quota("export", { limit: 3, per: "1m" });
//   if (q.take()) run(); else toast(`Try again in ${Math.ceil(q.resetIn() / 1000)} s`)
//   const send = r.limit("chat", { limit: 5, per: "10s" }, (m) => ws.send(m))  // undefined while over quota
//   r.pause("api", 30_000)    // a 429 Retry-After: every quota with this key waits
import { signal, getOwner, onCleanup, untrack, type Accessor } from "../../core/reactive.ts";
import { ms as duration } from "../duration.ts";
import { defineManager } from "../manager.ts";
import { publisher } from "../publish.ts";

export interface Limited<A extends unknown[]> {
  (...args: A): void;
  /** Drop a waiting call. */
  cancel(): void;
  /** Run a waiting call now. */
  flush(): void;
  /** A call is waiting (reactive). */
  pending: Accessor<boolean>;
}
export interface DebounceOptions { /** Also run at the start of a burst. */ leading?: boolean; /** Run at least this often during a long burst (ms). */ maxWait?: number }
export interface ThrottleOptions { /** Run on the first call (default true). */ leading?: boolean; /** Run once more after the window with the last arguments (default true). */ trailing?: boolean }
export interface QuotaOptions { limit: number; /** Window: ms or "10s" / "1m" / "1h". */ per: number | string }

export interface Quota {
  readonly key: string;
  /** Use `n` units if they are left; false when over the limit (or paused). */
  take(n?: number): boolean;
  /** Units left in the current window (reactive). */
  remaining(): number;
  /** ms until a unit frees up (0 when one is free). */
  resetIn(): number;
  reset(): void;
}

/** No options yet; quotas and timers live in memory and end with dispose(). */
export type RateConfig = Record<string, never>;

export interface RateLimiter {
  debounce<A extends unknown[]>(fn: (...a: A) => unknown, ms: number, o?: DebounceOptions): Limited<A>;
  throttle<A extends unknown[]>(fn: (...a: A) => unknown, ms: number, o?: ThrottleOptions): Limited<A>;
  /** The quota for `key` (the first call sets its options). */
  quota(key: string, o: QuotaOptions): Quota;
  /** fn guarded by a quota: returns fn's result, or undefined when over the limit. */
  limit<A extends unknown[], R>(key: string, o: QuotaOptions, fn: (...a: A) => R): (...a: A) => R | undefined;
  /** Hold every quota with this key for `ms` (server said 429 / Retry-After). */
  pause(key: string, ms: number): void;
  /** Quotas in use (devtools). */
  quotas(): Quota[];
  dispose(): void;
}

const pub = publisher("rate");

function create(): RateLimiter {
  const quotas = new Map<string, Quota>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number): ReturnType<typeof setTimeout> => {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
    return id;
  };
  const stop = (id: ReturnType<typeof setTimeout> | undefined): void => { if (id !== undefined) { clearTimeout(id); timers.delete(id); } };
  const owned = <A extends unknown[]>(f: Limited<A>): Limited<A> => { if (getOwner()) onCleanup(f.cancel); return f; };

  function debounce<A extends unknown[]>(fn: (...a: A) => unknown, ms: number, o: DebounceOptions = {}): Limited<A> {
    const pending = signal(false);
    let id: ReturnType<typeof setTimeout> | undefined, maxId: ReturnType<typeof setTimeout> | undefined, args: A | null = null;
    const fire = (): void => {
      stop(id); stop(maxId); id = maxId = undefined;
      const a = args; args = null; pending.set(false);
      if (a) fn(...a);
    };
    const f = ((...a: A) => {
      const burst = id === undefined;
      if (burst && o.leading) { fn(...a); args = null; } else { args = a; pending.set(true); }
      stop(id);
      id = later(() => (args ? fire() : (id = undefined, stop(maxId), maxId = undefined)), ms);
      if (o.maxWait !== undefined && maxId === undefined) maxId = later(fire, o.maxWait);
    }) as Limited<A>;
    f.cancel = () => { stop(id); stop(maxId); id = maxId = undefined; args = null; pending.set(false); };
    f.flush = fire;
    f.pending = pending;
    return owned(f);
  }

  function throttle<A extends unknown[]>(fn: (...a: A) => unknown, ms: number, o: ThrottleOptions = {}): Limited<A> {
    const leading = o.leading !== false, trailing = o.trailing !== false;
    const pending = signal(false);
    let id: ReturnType<typeof setTimeout> | undefined, args: A | null = null;
    const tick = (): void => {
      if (args && trailing) { const a = args; args = null; pending.set(false); fn(...a); id = later(tick, ms); }
      else { id = undefined; args = null; pending.set(false); }
    };
    const f = ((...a: A) => {
      if (id === undefined) {
        if (leading) fn(...a); else { args = a; pending.set(true); }
        id = later(tick, ms);
      } else { args = a; if (trailing) pending.set(true); }
    }) as Limited<A>;
    f.cancel = () => { stop(id); id = undefined; args = null; pending.set(false); };
    f.flush = () => { const a = args; f.cancel(); if (a) fn(...a); };
    f.pending = pending;
    return owned(f);
  }

  function quota(key: string, o: QuotaOptions): Quota {
    const found = quotas.get(key);
    if (found) return found;
    const per = duration(o.per);
    let used: number[] = []; // times of the units used in the window (sliding window)
    let pausedUntil = 0;
    const tick = signal(0);
    const prune = (): void => { const t = Date.now() - per; if (used.length && used[0]! <= t) used = used.filter((x) => x > t); };
    const refresh = (): void => {
      tick.update((n) => n + 1);
      const wait = q.resetIn();
      if (wait > 0) later(refresh, wait + 1); // remaining() goes up again by itself
    };
    const q: Quota & { pauseFor(ms: number): void } = {
      key,
      take(n = 1) {
        prune();
        if (Date.now() < pausedUntil || used.length + n > o.limit) { pub("blocked", { key, resetIn: q.resetIn() }); return false; }
        const now = Date.now();
        for (let i = 0; i < n; i++) used.push(now);
        pub("take", { key, remaining: o.limit - used.length });
        refresh();
        return true;
      },
      remaining: () => { tick(); prune(); return Date.now() < pausedUntil ? 0 : Math.max(0, o.limit - used.length); },
      resetIn() {
        prune();
        const p = Math.max(0, pausedUntil - Date.now());
        const w = used.length < o.limit ? 0 : Math.max(0, used[used.length - o.limit]! + per - Date.now());
        return Math.max(p, w);
      },
      reset() { used = []; pausedUntil = 0; untrack(() => tick.update((n) => n + 1)); pub("reset", { key }); },
      pauseFor(ms) { pausedUntil = Date.now() + ms; refresh(); },
    };
    quotas.set(key, q);
    return q;
  }

  return {
    debounce,
    throttle,
    quota,
    limit(key, o, fn) {
      const q = quota(key, o);
      return (...a) => (q.take() ? fn(...a) : undefined);
    },
    pause(key, ms) {
      for (const [k, q] of quotas) if (k === key || k.startsWith(`${key}:`)) (q as Quota & { pauseFor(ms: number): void }).pauseFor(ms);
      pub("pause", { key, ms });
    },
    quotas: () => [...quotas.values()],
    dispose() { for (const id of timers) clearTimeout(id); timers.clear(); quotas.clear(); },
  };
}

const manager = defineManager<RateLimiter, RateConfig>("rate", create, {});

/** The rate limiter (created on first call). */
export const rateLimit = (): RateLimiter => manager.get();
export const disposeRateLimit = (): void => manager.dispose();
export const rateManager = manager;
