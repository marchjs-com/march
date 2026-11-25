// Scratch storage for big documents: when the pixel memory of the layers passes a budget, the raster tiles of hidden
// or inactive layers are paged out to a store (IndexedDB in browsers, memory in tests), least recently used layers
// first, and paged back in when read. A paged raster keeps a PagedTiles map: reads of a paged tile load it back
// synchronously when the store can (memory), else the Pager loads layers ahead of use (pageIn) — hidden layers are
// the only ones paged out to an asynchronous store, and showing one pages it back in before the redraw.

import type { DocChange, ImageDocument } from "../document.ts";
import { hasRaster, walk, type Layer } from "../layers.ts";
import { TILE, type PixelArray, type TiledRaster } from "../tiles.ts";

/** Where paged tiles go. getSync is optional (only synchronous stores can fault tiles back during a render). */
export interface ScratchAdapter {
  put(key: string, data: PixelArray): void | Promise<void>;
  get(key: string): PixelArray | undefined | Promise<PixelArray | undefined>;
  getSync?: ((key: string) => PixelArray | undefined) | undefined;
  delete(key: string): void | Promise<void>;
  /** Bytes held (for diagnostics). */
  bytes?: (() => number) | undefined;
}

/** In-memory store (tests, or a compressed store's base). */
export class MemoryScratch implements ScratchAdapter {
  private m = new Map<string, PixelArray>();
  put(k: string, d: PixelArray): void { this.m.set(k, d); }
  get(k: string): PixelArray | undefined { return this.m.get(k); }
  getSync(k: string): PixelArray | undefined { return this.m.get(k); }
  delete(k: string): void { this.m.delete(k); }
  bytes(): number { let n = 0; for (const v of this.m.values()) n += v.byteLength; return n; }
  get size(): number { return this.m.size; }
}

/** IndexedDB store (browsers). Feature-detected: create() resolves null without IndexedDB. */
export class IndexedDBScratch implements ScratchAdapter {
  private db: IDBDatabase;
  private constructor(db: IDBDatabase) { this.db = db; }
  static create(name = "march-image-scratch"): Promise<IndexedDBScratch | null> {
    if (typeof indexedDB === "undefined") return Promise.resolve(null);
    return new Promise((resolve) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore("tiles"); };
      req.onsuccess = () => resolve(new IndexedDBScratch(req.result));
      req.onerror = () => resolve(null);
    });
  }
  private tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const r = fn(this.db.transaction("tiles", mode).objectStore("tiles"));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  put(k: string, d: PixelArray): Promise<void> { return this.tx("readwrite", (s) => s.put(d, k)).then(() => undefined); }
  get(k: string): Promise<PixelArray | undefined> { return this.tx("readonly", (s) => s.get(k) as IDBRequest<PixelArray | undefined>); }
  delete(k: string): Promise<void> { return this.tx("readwrite", (s) => s.delete(k)).then(() => undefined); }
}

let rasterSeq = 0;

/**
 * A tile map that remembers which keys are paged out. get / has / iteration fault paged tiles back in through the
 * synchronous store when there is one.
 */
export class PagedTiles extends Map<number, PixelArray> {
  readonly paged = new Set<number>();
  readonly id = `r${++rasterSeq}`;
  store: ScratchAdapter | null = null;

  private fault(k: number): void {
    if (!this.paged.has(k) || !this.store?.getSync) return;
    const t = this.store.getSync(`${this.id}:${k}`);
    this.paged.delete(k);
    void this.store.delete(`${this.id}:${k}`);
    if (t) super.set(k, t);
  }
  private faultAll(): void { if (this.paged.size && this.store?.getSync) for (const k of [...this.paged]) this.fault(k); }

  override get(k: number): PixelArray | undefined { this.fault(k); return super.get(k); }
  override has(k: number): boolean { this.fault(k); return super.has(k) || this.paged.has(k); }
  override set(k: number, v: PixelArray): this { if (this.paged.delete(k)) void this.store?.delete(`${this.id}:${k}`); return super.set(k, v); }
  override delete(k: number): boolean { const p = this.paged.delete(k); if (p) void this.store?.delete(`${this.id}:${k}`); return super.delete(k) || p; }
  override clear(): void { for (const k of this.paged) void this.store?.delete(`${this.id}:${k}`); this.paged.clear(); super.clear(); }
  override get size(): number { return super.size + this.paged.size; }
  /** Tiles in memory now. */
  get resident(): number { return super.size; }
  override keys(): MapIterator<number> { this.faultAll(); return super.keys(); }
  override values(): MapIterator<PixelArray> { this.faultAll(); return super.values(); }
  override entries(): MapIterator<[number, PixelArray]> { this.faultAll(); return super.entries(); }
  override forEach(cb: (v: PixelArray, k: number, m: Map<number, PixelArray>) => void, thisArg?: unknown): void { this.faultAll(); super.forEach(cb, thisArg); }
  override [Symbol.iterator](): MapIterator<[number, PixelArray]> { return this.entries(); }

  /** Move one resident tile to the store. */
  pageOut(k: number): number {
    const t = super.get(k);
    if (!t || !this.store) return 0;
    void this.store.put(`${this.id}:${k}`, t);
    super.delete(k);
    this.paged.add(k);
    return t.byteLength;
  }
  /** Bring every paged tile back (async stores). */
  async pageInAll(): Promise<void> {
    if (!this.store) return;
    for (const k of [...this.paged]) {
      const t = await this.store.get(`${this.id}:${k}`);
      if (!this.paged.has(k)) continue;
      this.paged.delete(k);
      void this.store.delete(`${this.id}:${k}`);
      if (t) super.set(k, t);
    }
  }
}

export interface PagerOptions {
  /** Bytes of resident layer pixels allowed before paging starts (default 1 GiB). */
  budget?: number | undefined;
  /** Page only below this fraction of the budget once started (hysteresis, default 0.8). */
  target?: number | undefined;
}

export class Pager {
  readonly doc: ImageDocument;
  readonly store: ScratchAdapter;
  budget: number;
  target: number;
  private used = new Map<string, number>();
  private clock = 0;
  private off: () => void;

  constructor(doc: ImageDocument, store: ScratchAdapter, o: PagerOptions = {}) {
    this.doc = doc; this.store = store;
    this.budget = o.budget ?? 1024 * 1024 * 1024;
    this.target = o.target ?? 0.8;
    this.off = doc.on((c) => this.onChange(c));
    this.touch(doc.activeId);
  }
  dispose(): void { this.off(); }

  /** Mark a layer as just used (the UI calls it for the active layer, painted layers, previews). */
  touch(id: string | null | undefined): void { if (id) this.used.set(id, ++this.clock); }

  /** Bytes of layer pixels in memory. */
  resident(): number {
    let n = 0;
    for (const [l] of walk(this.doc.layers)) if (hasRaster(l)) {
      const t = l.raster.tiles;
      n += (t instanceof PagedTiles ? t.resident : t.size) * TILE * TILE * 4 * (l.raster.depth / 8);
    }
    return n;
  }

  private paged(r: TiledRaster): PagedTiles {
    if (r.tiles instanceof PagedTiles) return r.tiles;
    const p = new PagedTiles();
    p.store = this.store;
    for (const [k, v] of r.tiles) p.set(k, v);
    r.tiles = p;
    return p;
  }

  /** Candidates, least recently used first: hidden layers, and inactive ones when the store is synchronous. */
  private candidates(): Layer[] {
    const out: Layer[] = [];
    for (const [l] of walk(this.doc.layers)) {
      if (!hasRaster(l) || l.id === this.doc.activeId) continue;
      if (!this.doc.visibleInTree(l.id) || this.store.getSync) out.push(l);
    }
    // hidden layers go first, then by last use
    return out.sort((a, b) => Number(this.doc.visibleInTree(a.id)) - Number(this.doc.visibleInTree(b.id)) || (this.used.get(a.id) ?? 0) - (this.used.get(b.id) ?? 0));
  }

  /** Page out until under target × budget (only when over budget). Returns the bytes paged out. */
  check(): number {
    let over = this.resident() - this.budget;
    if (over <= 0) return 0;
    over = this.resident() - this.budget * this.target;
    let freed = 0;
    for (const l of this.candidates()) {
      if (freed >= over) break;
      if (!hasRaster(l)) continue;
      const p = this.paged(l.raster);
      for (const k of [...Map.prototype.keys.call(p)] as number[]) {
        freed += p.pageOut(k);
        if (freed >= over) break;
      }
    }
    return freed;
  }

  /** Bring a layer's tiles back (before showing a layer paged to an asynchronous store). */
  async pageIn(id: string): Promise<void> {
    const l = this.doc.find(id);
    if (!l) return;
    for (const [x] of walk([l])) if (hasRaster(x) && x.raster.tiles instanceof PagedTiles) await x.raster.tiles.pageInAll();
    this.touch(id);
  }

  /** Everything back in memory (before saving, exporting, closing the store). */
  async restoreAll(): Promise<void> {
    for (const [l] of walk(this.doc.layers)) if (hasRaster(l) && l.raster.tiles instanceof PagedTiles) await l.raster.tiles.pageInAll();
  }

  private onChange(c: DocChange): void {
    this.touch(this.doc.activeId);
    if (c.step) for (const t of c.step.tiles) for (const [l] of walk(this.doc.layers)) if (hasRaster(l) && l.raster === t.raster) this.touch(l.id);
    if (c.structure && !this.store.getSync) {
      // a layer that became visible must be resident before the redraw
      for (const [l] of walk(this.doc.layers)) {
        if (hasRaster(l) && l.raster.tiles instanceof PagedTiles && l.raster.tiles.paged.size && this.doc.visibleInTree(l.id)) {
          void this.pageIn(l.id).then(() => this.doc.invalidate(null));
        }
      }
    }
  }
}
