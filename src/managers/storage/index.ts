// StorageManager: one API over localStorage, sessionStorage, memory and IndexedDB, with a key prefix, expiry, a data
// version and migrations. Blocked or full storage never throws: the value stays in memory and an "error" is reported.
//
//   import { storage, persisted } from "march/managers/storage";
//   configureStorage({ prefix: "app.", version: 2, migrations: { 2: (v, key) => key === "prefs" ? { ...v, dense: false } : v } });
//   const s = storage();
//   await s.area("idb").set("draft", bigObject)     // every area has the same async API
//   await s.area("local").get("prefs")              // migrated to version 2 on read (and written back)
//   s.local.set("token", t, { ttl: "1h" })           // local / session / memory also have a sync API
//   const theme = persisted("theme", "light")       // a signal kept in localStorage, synced across tabs
import { signal, untrack, getOwner, onCleanup, type Signal } from "../../core/reactive.ts";
import { ms as duration } from "../duration.ts";
import { defineManager } from "../manager.ts";
import { publisher } from "../publish.ts";

export type AreaName = "local" | "session" | "memory" | "idb";
/** Turns a value stored at version `from - 1` into version `from`. Gets the key, so one migration can treat keys apart. */
export type Migration = (value: any, key: string) => unknown;
export interface SetOptions { /** Expire after ms or "30s" / "5m" / "1d". */ ttl?: number | string }

export interface StorageConfig {
  /** Prepended to every key. Default "m.". */
  prefix: string;
  /** Current data version. Default 1. */
  version: number;
  /** version → migration that lifts a value to that version. */
  migrations: Record<number, Migration>;
  /** IndexedDB database name. Default "<prefix>db". */
  dbName: string | null;
}

/** The async API every area shares. */
export interface Area {
  readonly name: AreaName;
  get<T>(key: string, fallback?: T): Promise<T | undefined>;
  set(key: string, value: unknown, opts?: SetOptions): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}
/** local / session / memory: also usable synchronously. */
export interface SyncArea extends Area {
  getSync<T>(key: string, fallback?: T): T | undefined;
  setSync(key: string, value: unknown, opts?: SetOptions): void;
  removeSync(key: string): void;
  keysSync(): string[];
}

export interface StorageHub {
  area(name: "local" | "session" | "memory"): SyncArea;
  area(name: AreaName): Area;
  readonly local: SyncArea;
  readonly session: SyncArea;
  readonly memory: SyncArea;
  readonly idb: Area;
  /** Lift every stored value of an area to the current version now (also happens lazily on read). Returns how many moved. */
  migrate(area?: AreaName): Promise<number>;
  /** The area is backed by the real browser store (false: blocked, missing or full → memory). */
  persistent(area: AreaName): boolean;
  /** Changes made in another tab (localStorage only): key without prefix. Returns off. */
  onExternal(fn: (key: string, value: unknown) => void): () => void;
  dispose(): void;
}

/** What is stored: value, data version, expiry. */
interface Envelope { v: number; d: unknown; e?: number }

const pub = publisher("storage");

function create(cfg: StorageConfig): StorageHub {
  const P = cfg.prefix;
  const broken = new Set<AreaName>();
  const external = new Set<(key: string, value: unknown) => void>();

  let lifted = 0;
  const lift = (env: Envelope, key: string): { env: Envelope; moved: boolean } => {
    if (env.v >= cfg.version) return { env, moved: false };
    lifted++;
    let d = env.d;
    for (let v = env.v + 1; v <= cfg.version; v++) { const m = cfg.migrations[v]; if (m) d = m(d, key); }
    pub("migrate", { key, from: env.v, to: cfg.version });
    return { env: { ...env, v: cfg.version, d }, moved: true };
  };
  const wrap = (value: unknown, opts?: SetOptions): Envelope => {
    const ttl = duration(opts?.ttl);
    return ttl ? { v: cfg.version, d: value, e: Date.now() + ttl } : { v: cfg.version, d: value };
  };
  const fail = (area: AreaName, error: unknown): void => { broken.add(area); pub("error", { area, error }); };

  function syncArea(name: "local" | "session" | "memory"): SyncArea {
    const mem = new Map<string, string>();
    const real = (): Storage | null => {
      if (name === "memory" || broken.has(name)) return null;
      try { return (name === "local" ? globalThis.localStorage : globalThis.sessionStorage) ?? null; } catch (e) { fail(name, e); return null; }
    };
    const raw = {
      get: (k: string): string | null => { const s = real(); try { return s ? s.getItem(k) : mem.get(k) ?? null; } catch (e) { fail(name, e); return mem.get(k) ?? null; } },
      set: (k: string, v: string): void => { mem.set(k, v); const s = real(); if (s) try { s.setItem(k, v); mem.delete(k); } catch (e) { fail(name, e); } },
      del: (k: string): void => { mem.delete(k); try { real()?.removeItem(k); } catch (e) { fail(name, e); } },
      keys: (): string[] => {
        const s = real(), out = new Set(mem.keys());
        try { if (s) for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k) out.add(k); } } catch (e) { fail(name, e); }
        return [...out].filter((k) => k.startsWith(P));
      },
    };
    const getSync = <T>(key: string, fallback?: T): T | undefined => {
      const s = raw.get(P + key);
      if (s == null) return fallback;
      let env: Envelope;
      try { env = JSON.parse(s) as Envelope; } catch { return fallback; }
      if (!env || typeof env.v !== "number") return fallback;
      if (env.e && env.e <= Date.now()) { raw.del(P + key); pub("expire", { area: name, key }); return fallback; }
      const r = lift(env, key);
      if (r.moved) raw.set(P + key, JSON.stringify(r.env));
      return r.env.d as T;
    };
    const setSync = (key: string, value: unknown, opts?: SetOptions): void => {
      if (value === undefined) return removeSync(key);
      raw.set(P + key, JSON.stringify(wrap(value, opts)));
      pub("set", { area: name, key });
    };
    const removeSync = (key: string): void => { raw.del(P + key); pub("remove", { area: name, key }); };
    const keysSync = (): string[] => raw.keys().map((k) => k.slice(P.length));
    return {
      name, getSync, setSync, removeSync, keysSync,
      get: async (k, f) => getSync(k, f),
      set: async (k, v, o) => setSync(k, v, o),
      remove: async (k) => removeSync(k),
      keys: async () => keysSync(),
      clear: async () => { for (const k of keysSync()) raw.del(P + k); pub("clear", { area: name }); },
    };
  }

  // IndexedDB: one object store "kv"; without IndexedDB (or when it fails) the values live in memory
  let dbp: Promise<IDBDatabase | null> | null = null;
  const fallback = syncArea("memory");
  const db = (): Promise<IDBDatabase | null> => (dbp ??= new Promise((res) => {
    const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    if (!idb) { broken.add("idb"); res(null); return; }
    try {
      const rq = idb.open(cfg.dbName ?? `${P}db`, 1);
      rq.onupgradeneeded = () => { rq.result.createObjectStore("kv"); };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => { fail("idb", rq.error); res(null); };
    } catch (e) { fail("idb", e); res(null); }
  }));
  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> => {
    const d = await db();
    if (!d) return undefined;
    return new Promise((res, rej) => {
      const rq = fn(d.transaction("kv", mode).objectStore("kv"));
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
  };
  const idb: Area = {
    name: "idb",
    async get<T>(key: string, fb?: T) {
      if (!(await db())) return fallback.getSync(key, fb);
      const env = await tx<Envelope>("readonly", (s) => s.get(P + key) as IDBRequest<Envelope>);
      if (!env) return fb;
      if (env.e && env.e <= Date.now()) { await idb.remove(key); return fb; }
      const r = lift(env, key);
      if (r.moved) await tx("readwrite", (s) => s.put(r.env, P + key));
      return r.env.d as T;
    },
    async set(key, value, opts) {
      if (!(await db())) return fallback.setSync(key, value, opts);
      try { await tx("readwrite", (s) => s.put(wrap(value, opts), P + key)); pub("set", { area: "idb", key }); }
      catch (e) { fail("idb", e); fallback.setSync(key, value, opts); }
    },
    async remove(key) {
      if (!(await db())) return fallback.removeSync(key);
      await tx("readwrite", (s) => s.delete(P + key));
      pub("remove", { area: "idb", key });
    },
    async keys() {
      if (!(await db())) return fallback.keysSync();
      const all = (await tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys())) ?? [];
      return all.map(String).filter((k) => k.startsWith(P)).map((k) => k.slice(P.length));
    },
    async clear() { for (const k of await idb.keys()) await idb.remove(k); pub("clear", { area: "idb" }); },
  };

  const areas = { local: syncArea("local"), session: syncArea("session"), memory: fallback };
  const onStorage = (e: StorageEvent): void => {
    if (!e.key?.startsWith(P)) return;
    const key = e.key.slice(P.length);
    const value = e.newValue == null ? undefined : areas.local.getSync(key);
    pub("external", { key });
    for (const fn of [...external]) fn(key, value);
  };
  globalThis.addEventListener?.("storage", onStorage as EventListener);

  const hub: StorageHub = {
    area: ((n: AreaName) => (n === "idb" ? idb : areas[n])) as StorageHub["area"],
    ...areas,
    idb,
    async migrate(name = "local") {
      const a = hub.area(name);
      const before = lifted;
      for (const k of await a.keys()) await a.get(k); // a read lifts old values and writes them back
      return lifted - before;
    },
    persistent: (n) => n !== "memory" && !broken.has(n),
    onExternal(fn) {
      external.add(fn);
      const off = (): void => { external.delete(fn); };
      if (getOwner()) onCleanup(off);
      return off;
    },
    dispose() { globalThis.removeEventListener?.("storage", onStorage as EventListener); external.clear(); },
  };
  return hub;
}

const manager = defineManager<StorageHub, StorageConfig>("storage", create, { prefix: "m.", version: 1, migrations: {}, dbName: null });

/** The storage manager (created on first call). */
export const storage = (): StorageHub => manager.get();
/** Set the storage manager's options (merged into the current config). */
export const configureStorage = (config: Partial<StorageConfig>): void => manager.configure(config);
/** Stop the storage manager and remove its listeners; the next call starts it again. */
export const disposeStorage = (): void => manager.dispose();
/** The storage manager (get, configure, dispose). */
export const storageManager = manager;

/**
 * A signal kept in local (or session) storage: reads the stored value now, writes on every set, follows other tabs.
 * The value goes through the same prefix, version and migrations.
 */
export function persisted<T>(key: string, initial: T, opts: { area?: "local" | "session"; ttl?: number | string } = {}): Signal<T> {
  const a = untrack(storage)[opts.area ?? "local"];
  const s = signal<T>(a.getSync<T>(key, initial) as T, { name: `persisted.${key}` });
  const set = s.set;
  const write = (v: T): T => { set(v); a.setSync(key, v, opts.ttl === undefined ? undefined : { ttl: opts.ttl }); return v; };
  const out = Object.assign(s, { set: write, update: (fn: (v: T) => T) => write(fn(untrack(s))) }) as Signal<T>;
  if ((opts.area ?? "local") === "local") untrack(storage).onExternal((k, v) => { if (k === key) set((v === undefined ? initial : v) as T); });
  return out;
}
