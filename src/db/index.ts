// march/db — IndexedDB made plain: a database of named stores (records by a key, indexes on their fields), queries by
// key or index (equal, range, prefix, order, limit), transactions over several stores, and live queries that a
// component reads like a signal (they follow every change: this tab's and the other tabs'). Without IndexedDB (a
// test, a private window that refuses it) the same API runs in memory.
//
//   import { openDb } from "march/db";
//   const db = openDb("notes-app", { version: 1, stores: {
//     notes: { key: "id", autoIncrement: true, indexes: { byTag: { path: "tags", multi: true }, byDate: "updated" } },
//   } });
//   const notes = db.store<Note>("notes");
//   await notes.put({ title: "Hi", tags: ["work"], updated: Date.now() });
//   const work = await notes.find({ index: "byTag", eq: "work", order: "desc", limit: 20 });
//   const recent = notes.live({ index: "byDate", order: "desc", limit: 10 });   // recent() in a component; live
import { signal, batch, onCleanup, getOwner, reactive, type Accessor } from "../core/reactive.ts";

/** A key IndexedDB orders: a number, a string, a date, binary or an array of these. */
export type DbKey = number | string | Date | ArrayBuffer | ArrayBufferView | DbKey[];
/** An index of a store: the field (or fields) it orders records by; `multi` indexes each item of an array field. */
export interface IndexSpec { path: string | string[]; unique?: boolean; multi?: boolean }
/** A store: its key (a field of the record, fields, or none: the key is given on put) and its indexes. */
export interface StoreSpec { key?: string | string[]; autoIncrement?: boolean; indexes?: Record<string, IndexSpec | string> }
/** What the database holds at a version; `upgrade` runs on a version change after the stores are made (move data). */
export interface DbOptions {
  version: number;
  stores: Record<string, StoreSpec>;
  /** Runs inside the version change (the database's new version, the old one): a migration of the data. */
  upgrade?: (ctx: { db: IDBDatabase; tx: IDBTransaction; from: number; to: number }) => void;
  /** Keep the data in memory only (also when IndexedDB is missing). */
  memory?: boolean;
}
/** Which records: by the store's key or an index, equal to / in a range / starting with, in an order, a page of them. */
export interface DbQuery<T = unknown> {
  index?: string;
  eq?: DbKey; gt?: DbKey; gte?: DbKey; lt?: DbKey; lte?: DbKey;
  /** Text keys that start with it. */
  prefix?: string;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
  /** Kept when it returns true (after the key range; before limit / offset). */
  filter?: (value: T) => boolean;
}
/** A change of a store: what was written or removed (keys), or cleared. */
export interface DbChange { store: string; type: "put" | "delete" | "clear"; keys: DbKey[] }
/** A query that a component reads: its records (live), whether it is loading, its error, and a way to read again. */
export interface LiveQuery<T> extends Accessor<T> { loading: Accessor<boolean>; error: Accessor<unknown>; refresh(): Promise<void> }

export interface Store<T> {
  readonly name: string;
  get(key: DbKey): Promise<T | undefined>;
  getMany(keys: readonly DbKey[]): Promise<(T | undefined)[]>;
  /** Writes a record (a store without a key path takes `key`); returns its key. */
  put(value: T, key?: DbKey): Promise<DbKey>;
  /** Writes only when the key is new (else fails). */
  add(value: T, key?: DbKey): Promise<DbKey>;
  putMany(values: readonly T[]): Promise<DbKey[]>;
  /** Reads, changes and writes a record in one transaction (`fn` gets undefined when it is missing). */
  update(key: DbKey, fn: (value: T | undefined) => T | undefined): Promise<T | undefined>;
  delete(key: DbKey | DbQuery<T>): Promise<number>;
  clear(): Promise<void>;
  count(q?: DbQuery<T>): Promise<number>;
  keys(q?: DbQuery<T>): Promise<DbKey[]>;
  find(q?: DbQuery<T>): Promise<T[]>;
  first(q?: DbQuery<T>): Promise<T | undefined>;
  /** The records of a query, kept current: read it in a component (`notes()`); `loading()`, `error()`. */
  live(q?: DbQuery<T>): LiveQuery<T[]>;
  /** One record, kept current. */
  liveOne(key: DbKey): LiveQuery<T | undefined>;
  /** Called after every change of this store (this tab's and the others'). Returns off. */
  on(fn: (c: DbChange) => void): () => void;
}
export interface Db {
  readonly name: string;
  /** True when the data is in IndexedDB (false: memory only). */
  persistent(): Promise<boolean>;
  store<T = unknown>(name: string): Store<T>;
  /** One transaction over several stores: every write lands, or none. */
  tx<R>(stores: readonly string[], fn: (t: Record<string, TxStore>) => Promise<R> | R): Promise<R>;
  close(): void;
  /** Removes the database and its data. */
  destroy(): Promise<void>;
}
/** A store inside tx(): its reads and writes join that transaction. */
export interface TxStore { get(key: DbKey): Promise<unknown>; put(value: unknown, key?: DbKey): Promise<DbKey>; delete(key: DbKey): Promise<void>; find(q?: DbQuery): Promise<unknown[]> }

// ------------------------------------------------------------------------------------------------- keys and ranges
const typeRank = (k: unknown): number => (typeof k === "number" ? 1 : k instanceof Date ? 2 : typeof k === "string" ? 3 : k instanceof ArrayBuffer || ArrayBuffer.isView(k) ? 4 : Array.isArray(k) ? 5 : 0);
/** IndexedDB's order of keys: numbers < dates < strings < binary < arrays (each array item by item). */
export function compareKeys(a: unknown, b: unknown): number {
  const ta = typeRank(a), tb = typeRank(b);
  if (ta !== tb) return ta - tb;
  if (ta === 1) return (a as number) - (b as number);
  if (ta === 2) return +(a as Date) - +(b as Date);
  if (ta === 3) return (a as string) < (b as string) ? -1 : (a as string) > (b as string) ? 1 : 0;
  if (ta === 4) {
    const x = new Uint8Array(ArrayBuffer.isView(a) ? a.buffer : (a as ArrayBuffer)), y = new Uint8Array(ArrayBuffer.isView(b) ? b.buffer : (b as ArrayBuffer));
    for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i]! - y[i]!;
    return x.length - y.length;
  }
  if (ta === 5) {
    const x = a as unknown[], y = b as unknown[];
    for (let i = 0; i < Math.min(x.length, y.length); i++) { const c = compareKeys(x[i], y[i]); if (c) return c; }
    return x.length - y.length;
  }
  return 0;
}
/** The value at a key path ("a.b") of a record; an array path gives an array key. */
export function keyAt(value: unknown, path: string | string[]): unknown {
  if (Array.isArray(path)) return path.map((p) => keyAt(value, p));
  let v = value as Record<string, unknown> | undefined;
  for (const part of path.split(".")) { if (v == null) return undefined; v = v[part] as Record<string, unknown> | undefined; }
  return v;
}
/** A key is in the query's range. */
export function inRange(k: unknown, q: DbQuery<never>): boolean {
  if (q.eq !== undefined && compareKeys(k, q.eq) !== 0) return false;
  if (q.gt !== undefined && compareKeys(k, q.gt) <= 0) return false;
  if (q.gte !== undefined && compareKeys(k, q.gte) < 0) return false;
  if (q.lt !== undefined && compareKeys(k, q.lt) >= 0) return false;
  if (q.lte !== undefined && compareKeys(k, q.lte) > 0) return false;
  if (q.prefix !== undefined && !(typeof k === "string" && k.startsWith(q.prefix))) return false;
  return true;
}
const rangeOf = (q: DbQuery<never>): IDBKeyRange | undefined => {
  const R = (globalThis as { IDBKeyRange?: typeof IDBKeyRange }).IDBKeyRange;
  if (!R) return undefined;
  if (q.eq !== undefined) return R.only(q.eq);
  if (q.prefix !== undefined) return R.bound(q.prefix, `${q.prefix}￿`);
  const lo = q.gt ?? q.gte, hi = q.lt ?? q.lte;
  if (lo !== undefined && hi !== undefined) return R.bound(lo, hi, q.gt !== undefined, q.lt !== undefined);
  if (lo !== undefined) return R.lowerBound(lo, q.gt !== undefined);
  if (hi !== undefined) return R.upperBound(hi, q.lt !== undefined);
  return undefined;
};
const isQuery = (k: unknown): k is DbQuery => !!k && typeof k === "object" && !Array.isArray(k) && !(k instanceof Date) && !(k instanceof ArrayBuffer) && !ArrayBuffer.isView(k);
const indexSpec = (s: IndexSpec | string): IndexSpec => (typeof s === "string" ? { path: s } : s);

// ------------------------------------------------------------------------------------------------- the backends
/** What a backend does: the same operations over IndexedDB or memory. */
interface Backend {
  persistent: boolean;
  get(store: string, key: DbKey): Promise<unknown>;
  query(store: string, q: DbQuery, keysOnly?: boolean): Promise<{ key: DbKey; value: unknown }[]>;
  write(ops: { store: string; op: "put" | "add" | "delete" | "clear"; value?: unknown; key?: DbKey }[]): Promise<DbKey[]>;
  update(store: string, key: DbKey, fn: (v: unknown) => unknown): Promise<unknown>;
  close(): void;
  destroy(): Promise<void>;
}

/** The records in memory (a store: key → record, kept ordered by key); indexes are read by scanning. */
function memoryBackend(opts: DbOptions): Backend {
  const data = new Map<string, { key: DbKey; value: unknown }[]>(), seq = new Map<string, number>();
  for (const s of Object.keys(opts.stores)) data.set(s, []);
  const rows = (s: string): { key: DbKey; value: unknown }[] => { const r = data.get(s); if (!r) throw new Error(`march/db: no store "${s}"`); return r; };
  const keyOf = (s: string, value: unknown, key?: DbKey): DbKey => {
    const spec = opts.stores[s]!;
    if (spec.key) {
      let k = keyAt(value, spec.key) as DbKey | undefined;
      if (k === undefined && spec.autoIncrement && !Array.isArray(spec.key)) { k = (seq.get(s) ?? 0) + 1; (value as Record<string, unknown>)[spec.key] = k; }
      if (k === undefined) throw new Error(`march/db: the record has no key "${String(spec.key)}" (store "${s}")`);
      if (typeof k === "number") seq.set(s, Math.max(seq.get(s) ?? 0, k));
      return k;
    }
    if (key === undefined) { if (!spec.autoIncrement) throw new Error(`march/db: store "${s}" needs a key on put`); key = (seq.get(s) ?? 0) + 1; }
    if (typeof key === "number") seq.set(s, Math.max(seq.get(s) ?? 0, key));
    return key;
  };
  const clone = <V>(v: V): V => (typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v)) as V);
  const select = (s: string, q: DbQuery): { key: DbKey; value: unknown }[] => {
    const spec = opts.stores[s]!;
    let list: { key: DbKey; value: unknown; ik: unknown }[];
    if (q.index) {
      const ix = spec.indexes?.[q.index];
      if (!ix) throw new Error(`march/db: store "${s}" has no index "${q.index}"`);
      const { path, multi } = indexSpec(ix);
      list = rows(s).flatMap((r) => { const k = keyAt(r.value, path); return multi && Array.isArray(k) ? k.map((x) => ({ ...r, ik: x })) : k === undefined ? [] : [{ ...r, ik: k }]; });
      list.sort((a, b) => compareKeys(a.ik, b.ik) || compareKeys(a.key, b.key));
    } else list = rows(s).map((r) => ({ ...r, ik: r.key }));
    let out = list.filter((r) => inRange(r.ik, q as DbQuery<never>) && (!q.filter || q.filter(r.value)));
    if (q.order === "desc") out = out.reverse();
    out = out.slice(q.offset ?? 0, q.limit !== undefined ? (q.offset ?? 0) + q.limit : undefined);
    return out.map((r) => ({ key: r.key, value: clone(r.value) }));
  };
  const place = (s: string, key: DbKey, value: unknown, adding: boolean): void => {
    const r = rows(s), i = r.findIndex((x) => compareKeys(x.key, key) >= 0);
    if (i >= 0 && compareKeys(r[i]!.key, key) === 0) { if (adding) throw new Error(`march/db: key exists in "${s}"`); r[i] = { key, value }; }
    else r.splice(i < 0 ? r.length : i, 0, { key, value });
  };
  return {
    persistent: false,
    async get(s, key) { const r = rows(s).find((x) => compareKeys(x.key, key) === 0); return r ? clone(r.value) : undefined; },
    async query(s, q) { return select(s, q); },
    async write(ops) {
      const keys: DbKey[] = [];
      for (const o of ops) {
        if (o.op === "clear") { rows(o.store).length = 0; continue; }
        if (o.op === "delete") { const r = rows(o.store), i = r.findIndex((x) => compareKeys(x.key, o.key) === 0); if (i >= 0) r.splice(i, 1); keys.push(o.key!); continue; }
        const v = clone(o.value), k = keyOf(o.store, v, o.key);
        place(o.store, k, v, o.op === "add");
        keys.push(k);
      }
      return keys;
    },
    async update(s, key, fn) {
      const r = rows(s), cur = r.find((x) => compareKeys(x.key, key) === 0)?.value;
      const next = fn(cur === undefined ? undefined : clone(cur));
      if (next === undefined) { const i = r.findIndex((x) => compareKeys(x.key, key) === 0); if (i >= 0) r.splice(i, 1); }
      else place(s, opts.stores[s]!.key ? keyOf(s, next) : key, clone(next), false);
      return next;
    },
    close() { /* nothing to close */ },
    async destroy() { for (const r of data.values()) r.length = 0; },
  };
}

const req = <T>(r: IDBRequest<T>): Promise<T> => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (t: IDBTransaction): Promise<void> => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error ?? new Error("march/db: transaction aborted")); });

/** The records in IndexedDB. */
function idbBackend(name: string, opts: DbOptions, factory: IDBFactory): Promise<Backend> {
  return new Promise((resolve, reject) => {
    const open = factory.open(name, opts.version);
    open.onupgradeneeded = (e) => {
      const db = open.result, t = open.transaction!;
      for (const [s, spec] of Object.entries(opts.stores)) {
        const os = db.objectStoreNames.contains(s) ? t.objectStore(s) : db.createObjectStore(s, { ...(spec.key ? { keyPath: spec.key } : {}), autoIncrement: !!spec.autoIncrement });
        for (const [n, ix] of Object.entries(spec.indexes ?? {})) {
          const { path, unique, multi } = indexSpec(ix);
          if (!os.indexNames.contains(n)) os.createIndex(n, path, { unique: !!unique, multiEntry: !!multi });
        }
      }
      opts.upgrade?.({ db, tx: t, from: (e as IDBVersionChangeEvent).oldVersion, to: opts.version });
    };
    open.onerror = () => reject(open.error);
    open.onblocked = () => reject(new Error(`march/db: "${name}" is open in another tab at an older version; close it`));
    open.onsuccess = () => {
      const db = open.result;
      // another tab upgrades: this one lets go (it reopens on its next page load)
      db.onversionchange = () => db.close();
      const read = (s: string, q: DbQuery, keysOnly = false): Promise<{ key: DbKey; value: unknown }[]> => new Promise((res, rej) => {
        const t = db.transaction(s, "readonly"), os = t.objectStore(s), src = q.index ? os.index(q.index) : os;
        const out: { key: DbKey; value: unknown }[] = [];
        let skip = q.offset ?? 0;
        const range = rangeOf(q as DbQuery<never>), dir: IDBCursorDirection = q.order === "desc" ? "prev" : "next";
        const cur: IDBRequest<IDBCursor | null> = keysOnly && !q.filter ? src.openKeyCursor(range, dir) : src.openCursor(range, dir) as IDBRequest<IDBCursor | null>;
        cur.onerror = () => rej(cur.error);
        cur.onsuccess = () => {
          const c = cur.result as IDBCursorWithValue | null;
          if (!c || (q.limit !== undefined && out.length >= q.limit)) { res(out); return; }
          const value = keysOnly && !q.filter ? undefined : (c as IDBCursorWithValue).value;
          if (q.filter && !q.filter(value)) { c.continue(); return; }
          if (skip > 0) { skip--; c.continue(); return; }
          out.push({ key: c.primaryKey as DbKey, value });
          c.continue();
        };
      });
      resolve({
        persistent: true,
        get: (s, key) => req(db.transaction(s, "readonly").objectStore(s).get(key as IDBValidKey)),
        query: read,
        async write(ops) {
          const stores = [...new Set(ops.map((o) => o.store))], t = db.transaction(stores, "readwrite"), keys: DbKey[] = [];
          for (const o of ops) {
            const os = t.objectStore(o.store);
            if (o.op === "clear") os.clear();
            else if (o.op === "delete") { os.delete(o.key as IDBValidKey); keys.push(o.key!); }
            else { const r = o.op === "add" ? os.add(o.value, o.key as IDBValidKey | undefined) : os.put(o.value, o.key as IDBValidKey | undefined); r.onsuccess = () => keys.push(r.result as DbKey); }
          }
          await done(t);
          return keys;
        },
        async update(s, key, fn) {
          const t = db.transaction(s, "readwrite"), os = t.objectStore(s);
          const cur = await req(os.get(key as IDBValidKey)), next = fn(cur);
          if (next === undefined) os.delete(key as IDBValidKey); else os.put(next, os.keyPath ? undefined : (key as IDBValidKey));
          await done(t);
          return next;
        },
        close: () => db.close(),
        destroy: () => { db.close(); return req(factory.deleteDatabase(name)).then(() => undefined); },
      });
    };
  });
}

// ------------------------------------------------------------------------------------------------- the database
/** Opens (or makes) a database with its stores; it is usable at once (calls wait for it to open). */
export function openDb(name: string, opts: DbOptions): Db {
  const factory = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  const backend: Promise<Backend> = opts.memory || !factory ? Promise.resolve(memoryBackend(opts)) : idbBackend(name, opts, factory).catch(() => memoryBackend(opts));
  // changes: this tab's listeners at once, the other tabs' through a channel named after the database
  const listeners = new Map<string, Set<(c: DbChange) => void>>();
  // (a database in memory is this tab's alone: no channel)
  const channel = !opts.memory && factory && typeof BroadcastChannel === "function" ? new BroadcastChannel(`march-db:${name}`) : null;
  (channel as { unref?: () => void } | null)?.unref?.();
  const emit = (c: DbChange, local = true): void => {
    for (const fn of listeners.get(c.store) ?? []) fn(c);
    if (local) channel?.postMessage(c);
  };
  if (channel) channel.onmessage = (e: MessageEvent<DbChange>) => emit(e.data, false);
  const write = async (ops: Parameters<Backend["write"]>[0]): Promise<DbKey[]> => {
    const keys = await (await backend).write(ops);
    for (const s of new Set(ops.map((o) => o.store))) {
      const mine = ops.filter((o) => o.store === s);
      emit({ store: s, type: mine.some((o) => o.op === "clear") ? "clear" : mine.every((o) => o.op === "delete") ? "delete" : "put", keys: mine.some((o) => o.op === "clear") ? [] : keys.filter((_, i) => ops[i]?.store === s) });
    }
    return keys;
  };

  const storeOf = <T>(s: string): Store<T> => {
    if (!opts.stores[s]) throw new Error(`march/db: no store "${s}" in "${name}" (declare it in stores)`);
    const on = (fn: (c: DbChange) => void): (() => void) => {
      let set = listeners.get(s);
      if (!set) listeners.set(s, (set = new Set()));
      set.add(fn);
      return () => set!.delete(fn);
    };
    const live = <R>(read: () => Promise<R>, initial: R, touches: (c: DbChange) => boolean): LiveQuery<R> => {
      const value = signal<R>(initial), loading = signal(true), error = signal<unknown>(null);
      let n = 0;
      const refresh = async (): Promise<void> => {
        const k = ++n;
        loading.set(true);
        try { const v = await read(); if (k === n) batch(() => { value.set(v); error.set(null); }); }
        catch (e) { if (k === n) error.set(e); }
        finally { if (k === n) loading.set(false); }
      };
      void refresh();
      const off = on((c) => { if (touches(c)) void refresh(); });
      if (getOwner()) onCleanup(off);
      const acc = reactive(() => value()) as LiveQuery<R>;
      acc.loading = loading; acc.error = error; acc.refresh = refresh;
      (acc as unknown as { peek: () => R }).peek = () => value.peek();
      return acc;
    };
    const self: Store<T> = {
      name: s,
      get: async (key) => (await backend).get(s, key) as Promise<T | undefined>,
      getMany: async (keys) => { const b = await backend; return Promise.all(keys.map((k) => b.get(s, k) as Promise<T | undefined>)); },
      put: async (value, key) => (await write([{ store: s, op: "put", value, ...(key !== undefined ? { key } : {}) }]))[0]!,
      add: async (value, key) => (await write([{ store: s, op: "add", value, ...(key !== undefined ? { key } : {}) }]))[0]!,
      putMany: (values) => write(values.map((value) => ({ store: s, op: "put" as const, value }))),
      async update(key, fn) { const r = await (await backend).update(s, key, fn as (v: unknown) => unknown) as T | undefined; emit({ store: s, type: r === undefined ? "delete" : "put", keys: [key] }); return r; },
      async delete(key) {
        const keys: DbKey[] = isQuery(key) ? (await (await backend).query(s, key as DbQuery, true)).map((r) => r.key) : [key as DbKey];
        if (keys.length) await write(keys.map((k) => ({ store: s, op: "delete" as const, key: k })));
        return keys.length;
      },
      clear: async () => { await write([{ store: s, op: "clear" }]); },
      count: async (q = {}) => (await (await backend).query(s, q as DbQuery, true)).length,
      keys: async (q = {}) => (await (await backend).query(s, q as DbQuery, true)).map((r) => r.key),
      find: async (q = {}) => (await (await backend).query(s, q as DbQuery)).map((r) => r.value as T),
      first: async (q = {}) => (await (await backend).query(s, { ...q, limit: 1 } as DbQuery))[0]?.value as T | undefined,
      live: (q = {}) => live(() => self.find(q), [] as T[], () => true),
      liveOne: (key) => live(() => self.get(key), undefined as T | undefined, (c) => c.type === "clear" || c.keys.some((k) => compareKeys(k, key) === 0)),
      on,
    };
    return self;
  };
  const stores = new Map<string, Store<unknown>>();
  return {
    name,
    persistent: async () => (await backend).persistent,
    store: <T>(s: string) => { let st = stores.get(s); if (!st) stores.set(s, (st = storeOf<unknown>(s))); return st as unknown as Store<T>; },
    async tx(names, fn) {
      // a transaction's writes are gathered and written together (one IndexedDB transaction); reads see the store
      const ops: Parameters<Backend["write"]>[0] = [], b = await backend;
      const t = Object.fromEntries(names.map((s) => [s, {
        get: (key: DbKey) => b.get(s, key),
        put: async (value: unknown, key?: DbKey) => { ops.push({ store: s, op: "put", value, ...(key !== undefined ? { key } : {}) }); return key ?? (opts.stores[s]?.key ? keyAt(value, opts.stores[s]!.key!) as DbKey : -1); },
        delete: async (key: DbKey) => { ops.push({ store: s, op: "delete", key }); },
        find: async (q: DbQuery = {}) => (await b.query(s, q)).map((r) => r.value),
      } satisfies TxStore]));
      const r = await fn(t);
      if (ops.length) await write(ops);
      return r;
    },
    close: () => { channel?.close(); void backend.then((b) => b.close()); },
    destroy: async () => { channel?.close(); await (await backend).destroy(); },
  };
}
