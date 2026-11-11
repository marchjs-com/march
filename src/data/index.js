// HADI March data: queries with cache, de-duplication, retry, refresh on focus and polling; mutations with invalidation
// and optimistic updates. Works with any async function — fetch, RPC, Firebase callables, …
//
//   const users = query(() => api.list({ page: $page }), { key: () => ["users", $page] })
//   users()            → data (reactive)          users.loading() / users.error() / users.refreshing()
//   users.refetch()    users.mutate(v)            invalidate("users")   (refetches every active query whose key starts with "users")
//   const save = mutation((u) => api.save(u), { invalidates: ["users"] });  await save(u); save.pending()
import { signal, computed, effect, untrack, onCleanup, batch, getOwner } from "../core/reactive.ts";

const defaults = { retry: 2, retryDelay: 300, staleTime: 0, cacheTime: 5 * 60_000, refetchOnFocus: true, isRetryable: null, onError: null };
/** Change global defaults: `configure({ retry: 1, onError: (e) => toast.error(e.message) })`. */
export function configure(o) { Object.assign(defaults, o); }

const cache = new Map(); // keyString → { data, error, at, promise, subs: Set<query> }
const active = new Set();

const keyStr = (k) => (typeof k === "string" ? k : JSON.stringify(k));
function isRetryable(e) {
  if (defaults.isRetryable) return defaults.isRetryable(e);
  if (e?.name === "AbortError") return false;
  if (e?.transient === true) return true;
  if (e instanceof TypeError) return true; // network
  const s = Number(e?.status);
  return s === 408 || s === 429 || s >= 500;
}
const sleep = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  signal?.addEventListener("abort", () => { clearTimeout(t); rej(abortError()); }, { once: true });
});
const abortError = () => Object.assign(new Error("Aborted"), { name: "AbortError" });

async function withRetry(fn, retry, delay, signal) {
  for (let i = 0; ; i++) {
    try { return await fn(signal); }
    catch (e) {
      if (signal?.aborted || i >= retry || !isRetryable(e)) throw e;
      await sleep(delay * 2 ** i, signal);
    }
  }
}

/**
 * Reactive async data. `fn` may read signals: it re-runs when they change (previous request aborted).
 * @template T
 * @param {(ctx: {signal: AbortSignal}) => Promise<T>} fn
 * @param {{ key?: any | (() => any), initial?: T, retry?: number, staleTime?: number, refetchOnFocus?: boolean,
 *           poll?: number, keep?: boolean, enabled?: () => boolean, onError?: (e:any) => void }} [opts]
 */
export function query(fn, opts = {}) {
  if (typeof fn === "string") { const url = fn; fn = ({ signal }) => fetchJson(url, { signal }); opts = { key: url, ...opts }; }
  const data = signal(opts.initial);
  const error = signal(null);
  const loading = signal(true);
  const refreshing = signal(false);
  let ctl = null, currentKey = null, version = 0, lastAt = 0;
  const self = () => data();
  const keyOf = () => (typeof opts.key === "function" ? opts.key() : opts.key);

  const hasKey = opts.key !== undefined;
  /** Start a request. `first` is an already started promise (tracked call without key). */
  async function run(force = false, first = null, c = null) {
    const k = hasKey ? untrack(keyOf) : null;
    const ks = k == null ? null : keyStr(k);
    currentKey = ks;
    const v = ++version;
    const entry = ks ? cache.get(ks) : null;
    const staleTime = opts.staleTime ?? defaults.staleTime;
    if (entry && entry.data !== undefined && !force) {
      batch(() => { data.set(entry.data); error.set(null); loading.set(false); });
      if (Date.now() - entry.at < staleTime) return;
    }
    if (!c) { ctl?.abort(); ctl = c = new AbortController(); }
    batch(() => {
      if (untrack(data) === undefined || (!opts.keep && !entry)) loading.set(true);
      else refreshing.set(true);
    });
    try {
      let p = entry?.promise && !force ? entry.promise : null;
      if (!p) {
        let used = false;
        p = withRetry((signal) => (first && !used ? (used = true, first) : untrack(() => fn({ signal }))), opts.retry ?? defaults.retry, defaults.retryDelay, c.signal);
        if (ks) cache.set(ks, { ...(cache.get(ks) ?? {}), promise: p });
      }
      const result = await p;
      if (ks) cache.set(ks, { data: result, at: Date.now(), promise: null });
      if (v !== version) return;
      lastAt = Date.now();
      batch(() => { data.set(result); error.set(null); loading.set(false); refreshing.set(false); });
    } catch (e) {
      if (ks && cache.get(ks)?.promise) cache.set(ks, { ...cache.get(ks), promise: null });
      if (v !== version || e?.name === "AbortError") return;
      batch(() => { error.set(e); loading.set(false); refreshing.set(false); });
      (opts.onError ?? defaults.onError)?.(e);
    }
  }
  // Dependencies: with a key, the key function is tracked (and fn is called untracked, results cached by key).
  // Without a key, signals fn reads before its first await are tracked (no cache).
  effect(() => {
    if (opts.enabled && !opts.enabled()) { untrack(() => loading.set(false)); return; }
    if (hasKey) { keyOf(); untrack(() => run()); return; }
    ctl?.abort();
    const c = (ctl = new AbortController());
    let first;
    try { first = fn({ signal: c.signal }); } catch (e) { first = Promise.reject(e); }
    untrack(() => run(true, Promise.resolve(first), c));
  });

  const entryRef = { refetch: () => run(true), key: () => currentKey };
  active.add(entryRef);
  const onFocus = () => {
    if (globalThis.document?.visibilityState === "hidden") return;
    if (Date.now() - lastAt > Math.max(1000, opts.staleTime ?? defaults.staleTime)) run(true);
  };
  if ((opts.refetchOnFocus ?? defaults.refetchOnFocus) && globalThis.addEventListener) {
    globalThis.addEventListener("focus", onFocus);
    globalThis.document?.addEventListener?.("visibilitychange", onFocus);
  }
  let timer = null;
  if (opts.poll) timer = setInterval(() => { if (globalThis.document?.visibilityState !== "hidden") run(true); }, opts.poll);
  if (getOwner()) onCleanup(() => {
    ctl?.abort(); active.delete(entryRef); clearInterval(timer);
    globalThis.removeEventListener?.("focus", onFocus);
    globalThis.document?.removeEventListener?.("visibilitychange", onFocus);
  });

  self.data = data;
  self.loading = () => loading();
  self.error = () => error();
  self.refreshing = () => refreshing();
  self.refetch = () => run(true);
  self.mutate = (v) => { const val = typeof v === "function" ? v(untrack(data)) : v; data.set(val); if (currentKey) cache.set(currentKey, { data: val, at: Date.now() }); };
  self.state = () => (loading() ? "loading" : error() ? "error" : "ready");
  return self;
}

/** Refetch active queries whose key starts with `prefix` (string or array prefix). Clears matching cache entries. */
export function invalidate(prefix) {
  const arr = Array.isArray(prefix) ? prefix : [prefix];
  const p = keyStr(arr).slice(0, -1); // '["users",1'
  const hit = (k) => k != null && (k === keyStr(prefix) || k === String(prefix) || k.startsWith(`${p},`) || k === `${p}]`);
  for (const k of [...cache.keys()]) if (hit(k)) cache.delete(k);
  for (const q of active) if (hit(q.key())) q.refetch();
}

/**
 * A write operation. Returns an async function with `pending()` and `error()` signals.
 * @param {(vars: any) => Promise<any>} fn
 * @param {{ invalidates?: any[], optimistic?: (vars:any) => (void | (() => void)), onSuccess?: Function, onError?: Function }} [opts]
 */
export function mutation(fn, opts = {}) {
  const pending = signal(false), error = signal(null), last = signal(undefined);
  const run = async (vars) => {
    const undo = opts.optimistic?.(vars);
    batch(() => { pending.set(true); error.set(null); });
    try {
      const r = await fn(vars);
      last.set(r);
      for (const k of opts.invalidates ?? []) invalidate(k);
      await opts.onSuccess?.(r, vars);
      return r;
    } catch (e) {
      if (typeof undo === "function") undo();
      error.set(e);
      (opts.onError ?? defaults.onError)?.(e, vars);
      throw e;
    } finally { pending.set(false); }
  };
  run.pending = () => pending();
  run.error = () => error();
  run.result = () => last();
  return run;
}

/** Key-less query (no cache sharing). */
export const resource = (fn, opts) => query(fn, { ...opts, key: undefined });

/** fetch() wrapper: JSON in/out, errors carry `status` and the server's message. */
export async function fetchJson(url, { method = "GET", body, headers, signal } = {}) {
  const r = await fetch(url, { method, signal, headers: { accept: "application/json", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error(j?.message || j?.error?.message || j?.title || `HTTP ${r.status}`), { status: r.status, body: j });
  return j;
}

/** Drop all cached data (e.g. on sign-out). */
export function clearCache() { cache.clear(); }

export { access, can, role, hasRole, hasMethod, denied, signedIn, Can, Gate, setAccess } from "../access/index.js";
