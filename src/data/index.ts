// HADI March data: queries with cache, de-duplication, retry, refresh on focus and polling; mutations with invalidation
// and optimistic updates. Works with any async function — fetch, RPC, Firebase callables, …
//
//   const users = query(() => api.list({ page: $page }), { key: () => ["users", $page] })
//   users()            → data (reactive)          users.loading() / users.error() / users.refreshing()
//   users.refetch()    users.mutate(v)            invalidate("users")   (refetches every active query whose key starts with "users")
//   const save = mutation((u) => api.save(u), { invalidates: ["users"] });  await save(u); save.pending()
import { signal, effect, untrack, onCleanup, batch, getOwner, type Signal } from "../core/reactive.ts";

export interface DataDefaults {
  retry: number;
  retryDelay: number;
  staleTime: number;
  cacheTime: number;
  refetchOnFocus: boolean;
  isRetryable: ((e: unknown) => boolean) | null;
  onError: ((e: unknown, vars?: unknown) => void) | null;
}
const defaults: DataDefaults = { retry: 2, retryDelay: 300, staleTime: 0, cacheTime: 5 * 60_000, refetchOnFocus: true, isRetryable: null, onError: null };
/** Change global defaults: `configure({ retry: 1, onError: (e) => toast.error(e.message) })`. */
export function configure(o: Partial<DataDefaults>): void { Object.assign(defaults, o); }

/** Cache key: a string or any JSON-serializable value (usually an array like `["users", page]`). */
export type QueryKey = unknown;
interface CacheEntry { data?: unknown; at?: number; promise?: Promise<unknown> | null }
interface ActiveQuery { refetch: () => Promise<void>; key: () => string | null }

const cache = new Map<string, CacheEntry>(); // keyString → { data, at, promise }
const active = new Set<ActiveQuery>();

interface ErrorLike { name?: unknown; transient?: unknown; status?: unknown }
const keyStr = (k: QueryKey): string => (typeof k === "string" ? k : JSON.stringify(k));
function isRetryable(e: unknown): boolean {
  if (defaults.isRetryable) return defaults.isRetryable(e);
  const x = e as ErrorLike | null | undefined;
  if (x?.name === "AbortError") return false;
  if (x?.transient === true) return true;
  if (e instanceof TypeError) return true; // network
  const s = Number(x?.status);
  return s === 408 || s === 429 || s >= 500;
}
const sleep = (ms: number, signal?: AbortSignal): Promise<void> => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  signal?.addEventListener("abort", () => { clearTimeout(t); rej(abortError()); }, { once: true });
});
const abortError = (): Error => Object.assign(new Error("Aborted"), { name: "AbortError" });

async function withRetry<T>(fn: (signal: AbortSignal) => T | PromiseLike<T>, retry: number, delay: number, signal: AbortSignal): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(signal); }
    catch (e) {
      if (signal?.aborted || i >= retry || !isRetryable(e)) throw e;
      await sleep(delay * 2 ** i, signal);
    }
  }
}

export interface QueryContext { signal: AbortSignal }
export type QueryFn<T> = (ctx: QueryContext) => T | PromiseLike<T>;
export interface QueryOptions<T> {
  /** Cache key (or a reactive function returning it). Queries with the same key share data and requests. */
  key?: QueryKey | (() => QueryKey);
  initial?: T;
  retry?: number;
  staleTime?: number;
  refetchOnFocus?: boolean;
  /** Polling interval in ms. */
  poll?: number;
  /** Keep showing old data (refreshing) when the key changes. */
  keep?: boolean;
  enabled?: () => boolean;
  onError?: (e: unknown) => void;
}
export type QueryState = "loading" | "error" | "ready";
/** A reactive query: call it for the data (undefined until the first result unless `initial` is given). */
export interface Query<T> {
  (): T | undefined;
  data: Signal<T | undefined>;
  loading(): boolean;
  error(): unknown;
  refreshing(): boolean;
  refetch(): Promise<void>;
  mutate(v: T | undefined | ((prev: T | undefined) => T | undefined)): void;
  state(): QueryState;
}

/**
 * Reactive async data. `fn` may read signals: it re-runs when they change (previous request aborted).
 * A string is a URL fetched as JSON (and used as the key).
 */
export function query<T = unknown>(url: string, opts?: QueryOptions<T>): Query<T>;
export function query<T>(fn: QueryFn<T>, opts?: QueryOptions<T>): Query<T>;
export function query<T>(input: string | QueryFn<T>, options: QueryOptions<T> = {}): Query<T> {
  let fn: QueryFn<T>, opts: QueryOptions<T> = options;
  if (typeof input === "string") { const url = input; fn = ({ signal }) => fetchJson<T>(url, { signal }); opts = { key: url, ...opts }; }
  else fn = input;
  const data = signal<T | undefined>(opts.initial);
  const error = signal<unknown>(null);
  const loading = signal(true);
  const refreshing = signal(false);
  let ctl: AbortController | null = null, currentKey: string | null = null, version = 0, lastAt = 0;
  const self = (() => data()) as Query<T>;
  const keyOf = (): QueryKey => (typeof opts.key === "function" ? (opts.key as () => QueryKey)() : opts.key);

  const hasKey = opts.key !== undefined;
  /** Start a request. `first` is an already started promise (tracked call without key). */
  async function run(force = false, first: Promise<T> | null = null, c: AbortController | null = null): Promise<void> {
    const k = hasKey ? untrack(keyOf) : null;
    const ks = k == null ? null : keyStr(k);
    currentKey = ks;
    const v = ++version;
    const entry = ks ? cache.get(ks) : null;
    const staleTime = opts.staleTime ?? defaults.staleTime;
    if (entry && entry.data !== undefined && !force) {
      batch(() => { data.set(entry.data as T); error.set(null); loading.set(false); });
      if (Date.now() - (entry.at as number) < staleTime) return;
    }
    if (!c) { ctl?.abort(); ctl = c = new AbortController(); }
    const ctlNow: AbortController = c;
    batch(() => {
      if (untrack(data) === undefined || (!opts.keep && !entry)) loading.set(true);
      else refreshing.set(true);
    });
    try {
      let p = entry?.promise && !force ? (entry.promise as Promise<T>) : null;
      if (!p) {
        let used = false;
        p = withRetry((signal) => (first && !used ? (used = true, first) : untrack(() => fn({ signal }))), opts.retry ?? defaults.retry, defaults.retryDelay, ctlNow.signal);
        if (ks) cache.set(ks, { ...(cache.get(ks) ?? {}), promise: p });
      }
      const result = await p;
      if (ks) cache.set(ks, { data: result, at: Date.now(), promise: null });
      if (v !== version) return;
      lastAt = Date.now();
      batch(() => { data.set(result); error.set(null); loading.set(false); refreshing.set(false); });
    } catch (e) {
      if (ks && cache.get(ks)?.promise) cache.set(ks, { ...cache.get(ks), promise: null });
      if (v !== version || (e as ErrorLike | null)?.name === "AbortError") return;
      batch(() => { error.set(e); loading.set(false); refreshing.set(false); });
      (opts.onError ?? defaults.onError)?.(e);
    }
  }
  // Dependencies: with a key, the key function is tracked (and fn is called untracked, results cached by key).
  // Without a key, signals fn reads before its first await are tracked (no cache).
  effect(() => {
    if (opts.enabled && !opts.enabled()) { untrack(() => loading.set(false)); return; }
    if (hasKey) { keyOf(); void untrack(() => run()); return; }
    ctl?.abort();
    const c = (ctl = new AbortController());
    let first: T | PromiseLike<T>;
    try { first = fn({ signal: c.signal }); } catch (e) { first = Promise.reject(e); }
    void untrack(() => run(true, Promise.resolve(first), c));
  });

  const entryRef: ActiveQuery = { refetch: () => run(true), key: () => currentKey };
  active.add(entryRef);
  const onFocus = (): void => {
    if (globalThis.document?.visibilityState === "hidden") return;
    if (Date.now() - lastAt > Math.max(1000, opts.staleTime ?? defaults.staleTime)) void run(true);
  };
  if ((opts.refetchOnFocus ?? defaults.refetchOnFocus) && globalThis.addEventListener) {
    globalThis.addEventListener("focus", onFocus);
    globalThis.document?.addEventListener?.("visibilitychange", onFocus);
  }
  let timer: ReturnType<typeof setInterval> | undefined;
  if (opts.poll) timer = setInterval(() => { if (globalThis.document?.visibilityState !== "hidden") void run(true); }, opts.poll);
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
  self.mutate = (v) => { const val = typeof v === "function" ? (v as (prev: T | undefined) => T | undefined)(untrack(data)) : v; data.set(val); if (currentKey) cache.set(currentKey, { data: val, at: Date.now() }); };
  self.state = () => (loading() ? "loading" : error() ? "error" : "ready");
  return self;
}

/** Refetch active queries whose key starts with `prefix` (string or array prefix). Clears matching cache entries. */
export function invalidate(prefix: QueryKey): void {
  const arr: unknown = Array.isArray(prefix) ? prefix : [prefix];
  const p = keyStr(arr).slice(0, -1); // '["users",1'
  const hit = (k: string | null): boolean => k != null && (k === keyStr(prefix) || k === String(prefix) || k.startsWith(`${p},`) || k === `${p}]`);
  for (const k of [...cache.keys()]) if (hit(k)) cache.delete(k);
  for (const q of active) if (hit(q.key())) void q.refetch();
}

export interface MutationOptions<V, R> {
  /** Query key prefixes to invalidate after success. */
  invalidates?: readonly QueryKey[];
  /** Apply an optimistic change; may return an undo function (called on error). */
  optimistic?: (vars: V) => void | (() => void);
  onSuccess?: (result: R, vars: V) => unknown;
  onError?: (e: unknown, vars: V) => void;
}
/** A write operation: call it with variables; `pending()`, `error()` and `result()` are reactive. */
export interface Mutation<V, R> {
  (vars: V): Promise<R>;
  pending(): boolean;
  error(): unknown;
  result(): R | undefined;
}

/** A write operation. Returns an async function with `pending()` and `error()` signals. */
export function mutation<V = void, R = unknown>(fn: (vars: V) => R | PromiseLike<R>, opts: MutationOptions<V, R> = {}): Mutation<V, R> {
  const pending = signal(false), error = signal<unknown>(null), last = signal<R | undefined>(undefined);
  const run = (async (vars: V): Promise<R> => {
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
  }) as Mutation<V, R>;
  run.pending = () => pending();
  run.error = () => error();
  run.result = () => last();
  return run;
}

/** Key-less query (no cache sharing). */
export const resource = <T>(fn: QueryFn<T>, opts?: Omit<QueryOptions<T>, "key">): Query<T> => query(fn, { ...opts, key: undefined } as QueryOptions<T>);

export interface FetchJsonOptions { method?: string; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal | null }
interface ErrorBody { message?: string; error?: { message?: string }; title?: string }
/** fetch() wrapper: JSON in/out, errors carry `status` and the server's message. */
export async function fetchJson<T = unknown>(url: string | URL, { method = "GET", body, headers, signal }: FetchJsonOptions = {}): Promise<T> {
  const init = { method, signal, headers: { accept: "application/json", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers }, body: body !== undefined ? JSON.stringify(body) : undefined } as RequestInit;
  const r = await fetch(url, init);
  const j = (await r.json().catch(() => null)) as ErrorBody | null;
  if (!r.ok) throw Object.assign(new Error(j?.message || j?.error?.message || j?.title || `HTTP ${r.status}`), { status: r.status, body: j });
  return j as T;
}

/** Drop all cached data (e.g. on sign-out). */
export function clearCache(): void { cache.clear(); }

export { access, can, role, hasRole, hasMethod, denied, signedIn, Can, Gate, setAccess } from "../access/index.ts";
export type { AccessRegister, AccessState, AccessInput, Perm, PermCheck, Requirement, Denial } from "../access/index.ts";
// components of the "data" category (src/components/data, generated barrel)
export * from "../components/data/index.ts";
