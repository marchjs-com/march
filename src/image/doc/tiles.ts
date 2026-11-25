// Tiled raster storage: sparse 256×256 RGBA tiles (straight alpha) in the document's bit depth. Empty tiles are not
// stored. A raster has an integer offset (ox, oy) in document pixels, so moving a layer is lossless and instant.
// Writes go through tileForWrite(): the first write to a tile inside an edit hands the old tile to the journal (the
// history keeps only the tiles a command touched).

export const TILE = 256;
export const TILE_SHIFT = 8;

/** Bits per channel. @tr Kanal başına bit. */
export type BitDepth = 8 | 16 | 32;
export type PixelArray = Uint8ClampedArray | Uint16Array | Float32Array;

/** The largest channel value of a depth (32-bit is float, 1 = white). */
export const depthMax = (d: BitDepth): number => (d === 8 ? 255 : d === 16 ? 65535 : 1);

export function newTile(depth: BitDepth): PixelArray {
  const n = TILE * TILE * 4;
  return depth === 8 ? new Uint8ClampedArray(n) : depth === 16 ? new Uint16Array(n) : new Float32Array(n);
}

const KEY_OFF = 32768;
export const tileKey = (tx: number, ty: number): number => (tx + KEY_OFF) * 65536 + (ty + KEY_OFF);
export const keyTx = (k: number): number => Math.floor(k / 65536) - KEY_OFF;
export const keyTy = (k: number): number => (k % 65536) - KEY_OFF;

/**
 * The edit in progress (one per document change). The first write to a tile inside an edit hands the tile's old array
 * to the journal and writes into a copy, so the history keeps the old arrays untouched. Tiles shared with the history
 * or a snapshot are in the raster's copy-on-write set and are copied before any write.
 */
export interface Edit {
  journal(raster: TiledRaster, key: number, before: PixelArray | null): void;
  journalMask(mask: Mask, before: Uint8Array): void;
  touched: Map<TiledRaster, Set<number>>;
  masks: Set<Mask>;
}
let EDIT: Edit | null = null;
export const currentEdit = (): Edit | null => EDIT;
export function setEdit(e: Edit | null): void {
  if (!e && EDIT) {
    for (const [r, keys] of EDIT.touched) for (const k of keys) r.cow.add(k);
    for (const m of EDIT.masks) m.shared = true;
  }
  EDIT = e;
}

/** A rectangle in document pixels. */
export interface Rect { x: number; y: number; w: number; h: number }

export const rectEmpty = (r: Rect | null | undefined): boolean => !r || r.w <= 0 || r.h <= 0;
export function rectUnion(a: Rect | null, b: Rect | null): Rect | null {
  if (rectEmpty(a)) return rectEmpty(b) ? null : { ...b! };
  if (rectEmpty(b)) return { ...a! };
  const x = Math.min(a!.x, b!.x), y = Math.min(a!.y, b!.y);
  return { x, y, w: Math.max(a!.x + a!.w, b!.x + b!.w) - x, h: Math.max(a!.y + a!.h, b!.y + b!.h) - y };
}
export function rectIntersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.w, b.x + b.w) - x, h = Math.min(a.y + a.h, b.y + b.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}
/** Tile keys (document grid) a rectangle covers. */
export function tilesOf(r: Rect): number[] {
  const out: number[] = [];
  if (rectEmpty(r)) return out;
  const x0 = Math.floor(r.x / TILE), y0 = Math.floor(r.y / TILE);
  const x1 = Math.floor((r.x + r.w - 1) / TILE), y1 = Math.floor((r.y + r.h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) out.push(tileKey(tx, ty));
  return out;
}

export class TiledRaster {
  depth: BitDepth;
  /** Offset of the raster's tile grid in document pixels. */
  ox = 0;
  oy = 0;
  tiles = new Map<number, PixelArray>();
  /** Keys whose arrays are shared (history, snapshots, clones): copied before the next write. */
  cow = new Set<number>();
  /** Bumps on every change (thumbnails and caches compare it). */
  version = 0;

  constructor(depth: BitDepth = 8) {
    this.depth = depth;
  }

  get max(): number { return depthMax(this.depth); }

  tile(tx: number, ty: number): PixelArray | undefined {
    return this.tiles.get(tileKey(tx, ty));
  }

  /** Journal a tile once per edit; true when its array must be copied before writing. */
  private touch(k: number): boolean {
    const e = EDIT;
    let copy = this.cow.delete(k);
    if (e) {
      let set = e.touched.get(this);
      if (!set) e.touched.set(this, (set = new Set()));
      if (!set.has(k)) {
        set.add(k);
        e.journal(this, k, this.tiles.get(k) ?? null);
        copy = true;
      }
    }
    return copy;
  }

  /** The tile at a raster-grid position, created when missing; journaled and copied on the first write of an edit. */
  tileForWrite(tx: number, ty: number): PixelArray {
    const k = tileKey(tx, ty);
    let t = this.tiles.get(k);
    if (this.touch(k) && t) {
      t = t.slice();
      this.tiles.set(k, t);
    }
    if (!t) {
      t = newTile(this.depth);
      this.tiles.set(k, t);
    }
    this.version++;
    return t;
  }

  /** Put a tile back (undo / redo / load); the array stays shared with whoever handed it in. */
  restoreTile(key: number, data: PixelArray | null): void {
    if (data) { this.tiles.set(key, data); this.cow.add(key); }
    else { this.tiles.delete(key); this.cow.delete(key); }
    this.version++;
  }

  /** Drop a tile (journaled). */
  dropTile(tx: number, ty: number): void {
    const k = tileKey(tx, ty);
    if (!this.tiles.has(k)) return;
    this.touch(k);
    this.tiles.delete(k);
    this.version++;
  }

  clear(): void {
    for (const k of [...this.tiles.keys()]) this.touch(k);
    this.tiles.clear();
    this.cow.clear();
    this.version++;
  }

  /** Bounds of stored tiles in document pixels (coarse: whole tiles). */
  tileBounds(): Rect | null {
    let r: Rect | null = null;
    for (const k of this.tiles.keys()) r = rectUnion(r, { x: keyTx(k) * TILE + this.ox, y: keyTy(k) * TILE + this.oy, w: TILE, h: TILE });
    return r;
  }

  /** Exact bounds of pixels with alpha > 0, in document pixels. */
  bounds(): Rect | null {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [k, t] of this.tiles) {
      const bx = keyTx(k) * TILE + this.ox, by = keyTy(k) * TILE + this.oy;
      for (let y = 0; y < TILE; y++) {
        const row = y * TILE * 4;
        for (let x = 0; x < TILE; x++) {
          if (t[row + x * 4 + 3]! > 0) {
            if (bx + x < x0) x0 = bx + x;
            if (bx + x > x1) x1 = bx + x;
            if (by + y < y0) y0 = by + y;
            if (by + y > y1) y1 = by + y;
          }
        }
      }
    }
    return x1 < x0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  /** Read a document-space region as straight-alpha float RGBA (0–1, 32-bit may exceed 1). */
  read(x: number, y: number, w: number, h: number, out: Float32Array = new Float32Array(w * h * 4)): Float32Array {
    out.fill(0);
    const inv = 1 / this.max;
    const rx = x - this.ox, ry = y - this.oy;
    const tx0 = Math.floor(rx / TILE), ty0 = Math.floor(ry / TILE);
    const tx1 = Math.floor((rx + w - 1) / TILE), ty1 = Math.floor((ry + h - 1) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = this.tiles.get(tileKey(tx, ty));
        if (!t) continue;
        const sx0 = Math.max(rx, tx * TILE), sy0 = Math.max(ry, ty * TILE);
        const sx1 = Math.min(rx + w, (tx + 1) * TILE), sy1 = Math.min(ry + h, (ty + 1) * TILE);
        for (let sy = sy0; sy < sy1; sy++) {
          let si = ((sy - ty * TILE) * TILE + (sx0 - tx * TILE)) * 4;
          let di = ((sy - ry) * w + (sx0 - rx)) * 4;
          for (let sx = sx0; sx < sx1; sx++, si += 4, di += 4) {
            out[di] = t[si]! * inv; out[di + 1] = t[si + 1]! * inv; out[di + 2] = t[si + 2]! * inv; out[di + 3] = t[si + 3]! * inv;
          }
        }
      }
    }
    return out;
  }

  /** Write straight-alpha float RGBA into a document-space region. Fully transparent source tiles stay unstored. */
  write(x: number, y: number, w: number, h: number, src: Float32Array): void {
    const max = this.max, f32 = this.depth === 32;
    const rx = x - this.ox, ry = y - this.oy;
    const tx0 = Math.floor(rx / TILE), ty0 = Math.floor(ry / TILE);
    const tx1 = Math.floor((rx + w - 1) / TILE), ty1 = Math.floor((ry + h - 1) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const sx0 = Math.max(rx, tx * TILE), sy0 = Math.max(ry, ty * TILE);
        const sx1 = Math.min(rx + w, (tx + 1) * TILE), sy1 = Math.min(ry + h, (ty + 1) * TILE);
        if (!this.tiles.has(tileKey(tx, ty))) {
          let any = false;
          for (let sy = sy0; sy < sy1 && !any; sy++) for (let sx = sx0; sx < sx1; sx++) if (src[((sy - ry) * w + (sx - rx)) * 4 + 3]! > 0) { any = true; break; }
          if (!any) continue;
        }
        const t = this.tileForWrite(tx, ty);
        for (let sy = sy0; sy < sy1; sy++) {
          let di = ((sy - ty * TILE) * TILE + (sx0 - tx * TILE)) * 4;
          let si = ((sy - ry) * w + (sx0 - rx)) * 4;
          for (let sx = sx0; sx < sx1; sx++, si += 4, di += 4) {
            if (f32) { t[di] = src[si]!; t[di + 1] = src[si + 1]!; t[di + 2] = src[si + 2]!; t[di + 3] = src[si + 3]!; }
            else {
              t[di] = Math.round(clamp01(src[si]!) * max); t[di + 1] = Math.round(clamp01(src[si + 1]!) * max);
              t[di + 2] = Math.round(clamp01(src[si + 2]!) * max); t[di + 3] = Math.round(clamp01(src[si + 3]!) * max);
            }
          }
        }
      }
    }
  }

  /** One pixel as float RGBA. */
  get(x: number, y: number): [number, number, number, number] {
    const rx = x - this.ox, ry = y - this.oy;
    const t = this.tiles.get(tileKey(Math.floor(rx / TILE), Math.floor(ry / TILE)));
    if (!t) return [0, 0, 0, 0];
    const i = ((((ry % TILE) + TILE) % TILE) * TILE + (((rx % TILE) + TILE) % TILE)) * 4, inv = 1 / this.max;
    return [t[i]! * inv, t[i + 1]! * inv, t[i + 2]! * inv, t[i + 3]! * inv];
  }

  set(x: number, y: number, c: ArrayLike<number>): void {
    const rx = x - this.ox, ry = y - this.oy;
    const t = this.tileForWrite(Math.floor(rx / TILE), Math.floor(ry / TILE));
    const i = ((((ry % TILE) + TILE) % TILE) * TILE + (((rx % TILE) + TILE) % TILE)) * 4, max = this.max;
    for (let c2 = 0; c2 < 4; c2++) t[i + c2] = this.depth === 32 ? c[c2]! : Math.round(clamp01(c[c2]!) * max);
  }

  /** Fill a region with one color (straight alpha). */
  fill(r: Rect, c: ArrayLike<number>): void {
    const buf = new Float32Array(r.w * r.h * 4);
    for (let i = 0; i < buf.length; i += 4) { buf[i] = c[0]!; buf[i + 1] = c[1]!; buf[i + 2] = c[2]!; buf[i + 3] = c[3]!; }
    this.write(r.x, r.y, r.w, r.h, buf);
  }

  /** A copy that shares tile arrays until either side writes (copy on write). */
  clone(): TiledRaster {
    const r = new TiledRaster(this.depth);
    r.ox = this.ox; r.oy = this.oy;
    for (const [k, t] of this.tiles) { r.tiles.set(k, t); r.cow.add(k); this.cow.add(k); }
    return r;
  }

  /** Same pixels in another bit depth. */
  convert(depth: BitDepth): TiledRaster {
    if (depth === this.depth) return this.clone();
    const r = new TiledRaster(depth);
    r.ox = this.ox; r.oy = this.oy;
    const from = this.max, to = depthMax(depth);
    for (const [k, t] of this.tiles) {
      const n = newTile(depth);
      for (let i = 0; i < t.length; i++) n[i] = depth === 32 ? t[i]! / from : Math.round(clamp01(t[i]! / from) * to);
      r.tiles.set(k, n);
    }
    return r;
  }

  /** Move the stored tiles onto the document grid (offset 0), so tile reads line up again. */
  bake(): void {
    if (this.ox % TILE === 0 && this.oy % TILE === 0) {
      if (this.ox || this.oy) {
        const dx = this.ox / TILE, dy = this.oy / TILE, next = new Map<number, PixelArray>();
        for (const [k, t] of this.tiles) next.set(tileKey(keyTx(k) + dx, keyTy(k) + dy), t);
        this.tiles = next; this.ox = 0; this.oy = 0; this.version++;
      }
      return;
    }
    const b = this.tileBounds();
    if (!b) { this.ox = 0; this.oy = 0; return; }
    const px = this.read(b.x, b.y, b.w, b.h);
    this.clear();
    this.ox = 0; this.oy = 0;
    this.write(b.x, b.y, b.w, b.h, px);
  }

  /** Approximate memory in bytes. */
  bytes(): number {
    return this.tiles.size * TILE * TILE * 4 * (this.depth / 8);
  }
}

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** A single-channel 8-bit mask of the document's size (selections, layer masks, channels, quick mask). */
export class Mask {
  width: number;
  height: number;
  data: Uint8Array;
  /** Value outside the stored area (layer masks: 255 reveal all / 0 hide all). */
  outside = 0;
  version = 0;
  /** The array is held by the history or a snapshot: copy before writing. */
  shared = false;

  constructor(width: number, height: number, fill = 0) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height);
    if (fill) this.data.fill(fill);
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return this.outside;
    return this.data[y * this.width + x]!;
  }

  /** The array to write into: journaled once per edit, copied when shared. Call before every change. */
  writable(): Uint8Array {
    const e = EDIT;
    if (e && !e.masks.has(this)) {
      e.masks.add(this);
      e.journalMask(this, this.data);
      this.data = this.data.slice();
      this.shared = false;
    } else if (this.shared) {
      this.data = this.data.slice();
      this.shared = false;
    }
    this.version++;
    return this.data;
  }

  /** Replace the whole array (undo / redo); it stays shared with whoever handed it in. */
  restore(data: Uint8Array): void {
    this.data = data;
    this.shared = true;
    this.version++;
  }

  /** A copy sharing the array until either side writes. */
  clone(): Mask {
    const m = new Mask(0, 0);
    m.width = this.width; m.height = this.height;
    m.data = this.data;
    m.shared = this.shared = true;
    m.outside = this.outside;
    return m;
  }

  isEmpty(): boolean {
    for (let i = 0; i < this.data.length; i++) if (this.data[i]!) return false;
    return true;
  }

  bounds(): Rect | null {
    const { width: w, height: h, data } = this;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) if (data[row + x]!) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
}
