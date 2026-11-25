// Autosave and crash recovery: every N minutes and when the user pauses, a changed document is saved (.march-image
// bytes) with a small PNG thumbnail into IndexedDB (database "march-image-recovery", one record per document id, the
// last K versions). After a crash the app lists the recoveries and restores or discards them; a clean save clears them.
// Storage is an adapter: IndexedDB in browsers, memory (or anything else) in Node and tests.

import type { ImageDocument } from "./document.ts";
import { loadDocument, saveDocument } from "./format.ts";
import { renderRegion } from "./composite.ts";
import { encodePng } from "./export/png.ts";
import { resampleRGBA, toRaw } from "./export/index.ts";

export interface RecoveryVersion {
  /** Save time (ms since epoch). */
  at: number;
  /** .march-image bytes. */
  bytes: Uint8Array;
}
export interface RecoveryRecord {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Time of the newest version. */
  at: number;
  /** PNG bytes of a small preview. */
  thumbnail: Uint8Array | null;
  /** Oldest first. */
  versions: RecoveryVersion[];
}
export interface RecoveryInfo { id: string; name: string; width: number; height: number; at: number; thumbnail: Uint8Array | null; versions: number; bytes: number }

/** Where recoveries are kept. */
export interface RecoveryStorage {
  get(id: string): Promise<RecoveryRecord | undefined>;
  put(rec: RecoveryRecord): Promise<void>;
  delete(id: string): Promise<void>;
  all(): Promise<RecoveryRecord[]>;
}

/** In-memory storage (Node, tests, private windows without IndexedDB). */
export function memoryStorage(): RecoveryStorage & { records: Map<string, RecoveryRecord> } {
  const records = new Map<string, RecoveryRecord>();
  return {
    records,
    get: async (id) => records.get(id),
    put: async (rec) => { records.set(rec.id, rec); },
    delete: async (id) => { records.delete(id); },
    all: async () => [...records.values()],
  };
}

export const RECOVERY_DB = "march-image-recovery";
const STORE = "documents";

/** IndexedDB storage, or null when the runtime has none. */
export function indexedDbStorage(name = RECOVERY_DB): RecoveryStorage | null {
  const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (!idb) return null;
  let dbp: Promise<IDBDatabase> | null = null;
  const db = (): Promise<IDBDatabase> => (dbp ??= new Promise((res, rej) => {
    const req = idb.open(name, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" }); };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));
  const run = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => res(req.result);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
  };
  return {
    get: (id) => run("readonly", (s) => s.get(id) as IDBRequest<RecoveryRecord | undefined>),
    put: async (rec) => { await run("readwrite", (s) => s.put(rec)); },
    delete: async (id) => { await run("readwrite", (s) => s.delete(id)); },
    all: () => run("readonly", (s) => s.getAll() as IDBRequest<RecoveryRecord[]>),
  };
}

let defaultStorage: RecoveryStorage | null = null;
/** The storage used when none is passed: IndexedDB when present, memory otherwise. */
export function recoveryStorage(): RecoveryStorage {
  return (defaultStorage ??= indexedDbStorage() ?? memoryStorage());
}
/** Replace the default storage (tests, apps with their own store). */
export function setRecoveryStorage(s: RecoveryStorage | null): void { defaultStorage = s; }

/** A PNG preview whose longer side is `size` pixels. */
export async function thumbnailPng(doc: ImageDocument, size = 160): Promise<Uint8Array> {
  const k = Math.min(1, size / Math.max(doc.width, doc.height));
  const w = Math.max(1, Math.round(doc.width * k)), h = Math.max(1, Math.round(doc.height * k));
  // render at most 4× the thumbnail size per side, then box-filter down (big documents stay cheap)
  const step = Math.max(1, Math.floor(1 / k / 4));
  const rw = Math.ceil(doc.width / step), rh = Math.ceil(doc.height / step);
  let px: Float32Array;
  if (step === 1) px = renderRegion(doc, doc.bounds);
  else {
    px = new Float32Array(rw * rh * 4);
    // point-sample rows of the full render, one strip at a time
    for (let y = 0; y < rh; y++) {
      const row = renderRegion(doc, { x: 0, y: y * step, w: doc.width, h: 1 });
      for (let x = 0; x < rw; x++) px.set(row.subarray(x * step * 4, x * step * 4 + 4), (y * rw + x) * 4);
    }
  }
  const small = rw === w && rh === h ? px : resampleRGBA(px, rw, rh, w, h);
  return encodePng(toRaw(small, w, h, 8, null));
}

export interface AutosaveOptions {
  /** Minutes between saves while there are changes (default 5). */
  every?: number | undefined;
  /** Save after this many ms without changes (default 4000; 0 = off). */
  idle?: number | undefined;
  /** Versions kept per document (default 3). */
  keep?: number | undefined;
  storage?: RecoveryStorage | undefined;
  /** Thumbnail size in pixels (0 = none; default 160). */
  thumbnail?: number | undefined;
  /** Clock and timers (tests). */
  now?: (() => number) | undefined;
  setTimer?: ((fn: () => void, ms: number) => unknown) | undefined;
  clearTimer?: ((t: unknown) => void) | undefined;
  onSaved?: ((info: RecoveryInfo) => void) | undefined;
  onError?: ((e: unknown) => void) | undefined;
}

export interface Autosave {
  /** Save now if there are unsaved changes (force: even without). */
  save(force?: boolean): Promise<RecoveryInfo | null>;
  /** The document was saved by the user: drop its recoveries. */
  cleanSave(): Promise<void>;
  /** Stop listening (recoveries stay). */
  stop(): void;
  readonly pending: boolean;
}

/** Start autosaving a document. */
export function autosave(doc: ImageDocument, o: AutosaveOptions = {}): Autosave {
  const storage = o.storage ?? recoveryStorage();
  const now = o.now ?? Date.now;
  const set = o.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clear = o.clearTimer ?? ((t: unknown) => clearTimeout(t as ReturnType<typeof setTimeout>));
  const every = (o.every ?? 5) * 60000, idle = o.idle ?? 4000, keep = Math.max(1, o.keep ?? 3);
  let changed = false, queue: Promise<unknown> = Promise.resolve(), idleT: unknown = null, tickT: unknown = null, stopped = false;

  // saves run one after another: a save asked for while one runs waits for it, then saves what changed since
  const doSave = async (force: boolean): Promise<RecoveryInfo | null> => {
    if (!changed && !force) return null;
    changed = false;
    try {
      const bytes = await saveDocument(doc);
      const thumb = o.thumbnail === 0 ? null : await thumbnailPng(doc, o.thumbnail ?? 160);
      const prev = await storage.get(doc.id);
      const at = now();
      const versions = [...(prev?.versions ?? []), { at, bytes }].slice(-keep);
      const rec: RecoveryRecord = { id: doc.id, name: doc.name, width: doc.width, height: doc.height, at, thumbnail: thumb, versions };
      await storage.put(rec);
      const info = infoOf(rec);
      o.onSaved?.(info);
      return info;
    } catch (e) { changed = true; o.onError?.(e); return null; }
  };
  const save = (force = false): Promise<RecoveryInfo | null> => {
    const p = queue.then(() => doSave(force));
    queue = p.catch(() => null);
    return p;
  };
  const tick = (): void => { if (stopped) return; void save(); tickT = set(tick, every); };
  const off = doc.on((c) => {
    if (c.how === "live") return;
    changed = true;
    if (idle > 0) { if (idleT) clear(idleT); idleT = set(() => { idleT = null; void save(); }, idle); }
  });
  tickT = set(tick, every);
  return {
    save,
    cleanSave: async () => { changed = false; if (idleT) { clear(idleT); idleT = null; } await queue; await storage.delete(doc.id); },
    stop: () => { stopped = true; off(); if (idleT) clear(idleT); if (tickT) clear(tickT); },
    get pending() { return changed; },
  };
}

const infoOf = (r: RecoveryRecord): RecoveryInfo => ({
  id: r.id, name: r.name, width: r.width, height: r.height, at: r.at, thumbnail: r.thumbnail, versions: r.versions.length,
  bytes: r.versions.reduce((n, v) => n + v.bytes.byteLength, 0),
});

/** Documents that can be recovered, newest first. */
export async function listRecoveries(storage: RecoveryStorage = recoveryStorage()): Promise<RecoveryInfo[]> {
  return (await storage.all()).map(infoOf).sort((a, b) => b.at - a.at);
}

/** Open a recovered document (the newest version, or `version` counted from the newest: 0, 1, …). */
export async function restore(id: string, opts: { version?: number; storage?: RecoveryStorage } = {}): Promise<ImageDocument> {
  const rec = await (opts.storage ?? recoveryStorage()).get(id);
  if (!rec || !rec.versions.length) throw new Error(`No recovery for ${id}`);
  const v = rec.versions[rec.versions.length - 1 - (opts.version ?? 0)];
  if (!v) throw new Error(`Recovery ${id} has no version ${opts.version}`);
  const doc = await loadDocument(v.bytes);
  doc.id = rec.id;
  doc.dirtySinceSave = true;
  return doc;
}

/** Throw a recovery away. */
export async function discard(id: string, storage: RecoveryStorage = recoveryStorage()): Promise<void> {
  await storage.delete(id);
}
