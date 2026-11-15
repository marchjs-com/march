// CacheManager: an in-memory cache for computed or fetched values — TTL ("30s" / "5m", the same syntax as net), LRU
// eviction, tags, stale-while-revalidate and in-flight dedupe. After appCache().follow(onInvalidate) (from
// march/net), net.invalidate("users") also clears entries tagged "users" (or whose key starts with it), so one
// call refreshes the request cache and this one.
//
//   import { appCache } from "march/managers/cache";
//   const c = appCache();
//   c.set("rates", data, { ttl: "5m", tags: ["money"] });   c.get("rates")
//   const user = await c.wrap(`user:${id}`, () => net.get(`/api/users/${id}`), { ttl: "1m", swr: true });
//   c.invalidate("money")   c.stats()   c.entries()        // stats and entries are reactive (devtools, panels)
//   c.follow(onInvalidate)                                  // import { onInvalidate } from "march/net"
import { signal, type Accessor } from "../../core/reactive.ts";
import { ms as duration } from "../duration.ts";
import { defineManager } from "../manager.ts";
import { publisher } from "../publish.ts";

export interface CacheSetOptions {
  /** Freshness: ms or "30s" / "5m" / "1h". 0 = no expiry. Default: config ttl. */
  ttl?: number | string;
  tags?: string[];
}
export interface WrapOptions extends CacheSetOptions {
  /** Serve a stale value at once and refresh it in the background. */
  swr?: boolean;
}
export interface CacheEntryInfo { key: string; tags: string[]; age: number; ttl: number; stale: boolean; hits: number }
export interface CacheStats { hits: number; misses: number; sets: number; evictions: number; size: number }

export interface CacheConfig {
  /** Most entries kept; the least recently used goes first. Default 500. */
  maxEntries: number;
  /** Default freshness (ms or "5m"). Default "5m". */
  ttl: number | string;
  /** Keep expired entries for stale-while-revalidate this much longer. Default "1h". */
  staleFor: number | string;
}

export interface AppCache {
  get<T>(key: string): T | undefined;
  /** Fresh or stale value without counting a hit (devtools). */
  peek<T>(key: string): T | undefined;
  set<T>(key: string, value: T, opts?: CacheSetOptions): T;
  has(key: string): boolean;
  delete(key: string): boolean;
  /** Cached value, or the result of `load` (one load per key at a time). */
  wrap<T>(key: string, load: () => T | Promise<T>, opts?: WrapOptions): Promise<T>;
  /** Follow another layer's invalidation hook, e.g. net's onInvalidate. Returns off. */
  follow(hook: (fn: (prefix: string) => void) => () => unknown): () => void;
  /** Drop entries with this tag or key prefix. Returns how many. */
  invalidate(tagOrPrefix: string): number;
  clear(): void;
  stats(): CacheStats;
  entries(): CacheEntryInfo[];
  dispose(): void;
}

interface Entry { value: unknown; at: number; ttl: number; tags: string[]; hits: number }
const pub = publisher("cache");

function create(cfg: CacheConfig): AppCache {
  const map = new Map<string, Entry>(); // insertion order = LRU order (oldest first)
  const flights = new Map<string, Promise<unknown>>();
  const version = signal(0, { name: "cache.version" });
  const counts = { hits: 0, misses: 0, sets: 0, evictions: 0 };
  const staleFor = duration(cfg.staleFor);
  // stats / entries bump in a microtask: get() may run inside a binding, where writing a signal is not allowed
  let queued = false;
  const changed = (): void => { if (!queued) { queued = true; queueMicrotask(() => { queued = false; version.update((v) => v + 1); }); } };

  const state = (e: Entry): "fresh" | "stale" | "dead" => {
    if (!e.ttl) return "fresh";
    const age = Date.now() - e.at;
    return age < e.ttl ? "fresh" : age < e.ttl + staleFor ? "stale" : "dead";
  };
  const touch = (key: string, e: Entry): void => { map.delete(key); map.set(key, e); };

  function set<T>(key: string, value: T, opts: CacheSetOptions = {}): T {
    const e: Entry = { value, at: Date.now(), ttl: duration(opts.ttl ?? cfg.ttl), tags: opts.tags ?? [], hits: 0 };
    map.delete(key);
    map.set(key, e);
    counts.sets++;
    while (map.size > cfg.maxEntries) {
      const oldest = map.keys().next().value as string;
      map.delete(oldest);
      counts.evictions++;
      pub("evict", { key: oldest });
    }
    pub("set", { key });
    changed();
    return value;
  }
  function get<T>(key: string): T | undefined {
    const e = map.get(key);
    if (!e || state(e) !== "fresh") {
      counts.misses++;
      if (e && state(e) === "dead") map.delete(key);
      pub("miss", { key });
      changed();
      return undefined;
    }
    e.hits++;
    counts.hits++;
    touch(key, e);
    pub("hit", { key });
    changed();
    return e.value as T;
  }
  function load<T>(key: string, fn: () => T | Promise<T>, opts: CacheSetOptions): Promise<T> {
    let p = flights.get(key) as Promise<T> | undefined;
    if (!p) {
      p = Promise.resolve().then(fn).then((v) => set(key, v, opts));
      const f = p.finally(() => flights.delete(key));
      f.catch(() => undefined);
      flights.set(key, p);
    }
    return p;
  }
  function invalidate(tag: string): number {
    let n = 0;
    for (const [k, e] of [...map]) if (e.tags.includes(tag) || k.startsWith(tag)) { map.delete(k); n++; }
    if (n) { pub("invalidate", { tag, count: n }); changed(); }
    return n;
  }

  const follows = new Set<() => unknown>();

  return {
    get,
    peek: (key) => { const e = map.get(key); return e && state(e) !== "dead" ? (e.value as never) : undefined; },
    set,
    has: (key) => { const e = map.get(key); return !!e && state(e) === "fresh"; },
    delete: (key) => { const ok = map.delete(key); if (ok) { pub("delete", { key }); changed(); } return ok; },
    async wrap<T>(key: string, fn: () => T | Promise<T>, opts: WrapOptions = {}): Promise<T> {
      const e = map.get(key);
      const s = e ? state(e) : "dead";
      if (e && s === "fresh") return get<T>(key) as T;
      if (e && s === "stale" && opts.swr) {
        e.hits++; counts.hits++; touch(key, e);
        pub("stale", { key });
        changed();
        void load(key, fn, opts).catch((error) => pub("error", { key, error }));
        return e.value as T;
      }
      counts.misses++;
      pub("miss", { key });
      return load(key, fn, opts);
    },
    follow(hook) {
      const off = hook((prefix) => { invalidate(prefix); });
      follows.add(off);
      return () => { follows.delete(off); off(); };
    },
    invalidate,
    clear() { map.clear(); changed(); pub("clear"); },
    stats: () => { version(); return { ...counts, size: map.size }; },
    entries: () => {
      version();
      const now = Date.now();
      return [...map].reverse().map(([key, e]) => ({ key, tags: e.tags, age: now - e.at, ttl: e.ttl, stale: state(e) !== "fresh", hits: e.hits }));
    },
    dispose() { for (const off of follows) off(); follows.clear(); map.clear(); flights.clear(); },
  };
}

const manager = defineManager<AppCache, CacheConfig>("cache", create, { maxEntries: 500, ttl: "5m", staleFor: "1h" });

/** The app cache (created on first call). */
export const appCache = (): AppCache => manager.get();
/** Set the cache manager's options (merged into the current config). */
export const configureCache = (config: Partial<CacheConfig>): void => manager.configure(config);
/** Stop the cache manager and remove its listeners; the next call starts it again. */
export const disposeCache = (): void => manager.dispose();
/** The cache manager (get, configure, dispose). */
export const cacheManager = manager;
