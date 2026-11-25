// History: every document change is one step holding the structure before / after and the tiles and masks it
// touched (old and new arrays, shared copy-on-write). Unlimited undo within a memory cap; snapshots; the state of any
// step can be read back (history brush source).

import { Mask, TiledRaster, keyTx, keyTy, setEdit, type Edit, type PixelArray } from "./tiles.ts";

export interface TileDelta { raster: TiledRaster; key: number; before: PixelArray | null; after: PixelArray | null }
export interface MaskDelta { mask: Mask; before: Uint8Array; after: Uint8Array }

/** A snapshot of the document's structure (layer tree and document fields, pixel data by reference). */
export type State = Record<string, unknown>;

export interface Step {
  id: number;
  label: string;
  /** Tool or command id (icon in the History panel). */
  kind?: string | undefined;
  at: number;
  before: State;
  after: State;
  tiles: TileDelta[];
  masks: MaskDelta[];
  bytes: number;
}

export interface Snapshot { id: number; name: string; at: number; state: State; rasters: Map<TiledRaster, TiledRaster>; masks: Map<Mask, Uint8Array> }

export interface HistoryHost {
  /** Capture the document's structure (pixel data by reference). */
  capture(): State;
  /** Put a captured structure back. */
  apply(state: State): void;
  /** Every raster and mask the structure refers to. */
  pixelData(state: State): { rasters: TiledRaster[]; masks: Mask[] };
  /** Called after undo / redo / jump with the step that changed. */
  changed(step: Step | null, how: "do" | "undo" | "redo" | "jump" | "clear"): void;
}

let stepSeq = 1;

const bytesOf = (a: ArrayBufferView | null): number => (a ? a.byteLength : 0);

export class History {
  steps: Step[] = [];
  /** Steps applied: steps[0 .. index-1] are done; the rest can be redone. */
  index = 0;
  snapshots: Snapshot[] = [];
  /** Maximum number of steps (0 = no limit) and the memory cap in bytes for undo data. */
  limit = 0;
  memoryCap = 1024 * 1024 * 1024;
  /** The open change (begin … commit). */
  private open: { label: string; kind?: string | undefined; before: State; edit: Edit; tiles: TileDelta[]; masks: MaskDelta[]; depth: number } | null = null;
  host: HistoryHost;
  /** Source of the history brush: a snapshot id or a step index; null = the document's opening state. */
  brushSource: { snapshot?: number | undefined; step?: number } | null = null;

  constructor(host: HistoryHost) {
    this.host = host;
  }

  get busy(): boolean { return !!this.open; }
  canUndo(): boolean { return this.index > 0 && !this.open; }
  canRedo(): boolean { return this.index < this.steps.length && !this.open; }

  /** Start a change; nested begin() calls join the outer one. */
  begin(label: string, kind?: string): void {
    if (this.open) { this.open.depth++; return; }
    const tiles: TileDelta[] = [], masks: MaskDelta[] = [];
    const edit: Edit = {
      touched: new Map(),
      masks: new Set(),
      journal: (raster, key, before) => tiles.push({ raster, key, before, after: null }),
      journalMask: (mask, before) => masks.push({ mask, before, after: before }),
    };
    this.open = { label, kind, before: this.host.capture(), edit, tiles, masks, depth: 1 };
    setEdit(edit);
  }

  /** Close the change: it becomes one step (nothing changed → no step). Returns the step. */
  commit(label?: string): Step | null {
    const o = this.open;
    if (!o) return null;
    if (--o.depth > 0) return null;
    setEdit(null);
    this.open = null;
    for (const t of o.tiles) t.after = t.raster.tiles.get(t.key) ?? null;
    for (const m of o.masks) m.after = m.mask.data;
    const after = this.host.capture();
    if (!o.tiles.length && !o.masks.length && sameState(o.before, after)) { this.host.changed(null, "do"); return null; }
    const step: Step = {
      id: stepSeq++, label: label ?? o.label, kind: o.kind, at: Date.now(), before: o.before, after,
      tiles: o.tiles, masks: o.masks,
      bytes: o.tiles.reduce((n, t) => n + bytesOf(t.before) + bytesOf(t.after), 0) + o.masks.reduce((n, m) => n + m.before.byteLength + m.after.byteLength, 0) + 512,
    };
    this.steps.length = this.index;
    this.steps.push(step);
    this.index++;
    this.trim();
    this.host.changed(step, "do");
    return step;
  }

  /** Throw the open change away and put everything back. */
  cancel(): void {
    const o = this.open;
    if (!o) return;
    setEdit(null);
    this.open = null;
    for (let i = o.tiles.length - 1; i >= 0; i--) o.tiles[i]!.raster.restoreTile(o.tiles[i]!.key, o.tiles[i]!.before);
    for (let i = o.masks.length - 1; i >= 0; i--) o.masks[i]!.mask.restore(o.masks[i]!.before);
    this.host.apply(o.before);
    this.host.changed(null, "undo");
  }

  /** Run fn as one step. */
  change<T>(label: string, fn: () => T, kind?: string): T {
    this.begin(label, kind);
    try {
      const r = fn();
      this.commit();
      return r;
    } catch (e) {
      this.cancel();
      throw e;
    }
  }

  private undoStep(s: Step): void {
    for (let i = s.tiles.length - 1; i >= 0; i--) s.tiles[i]!.raster.restoreTile(s.tiles[i]!.key, s.tiles[i]!.before);
    for (let i = s.masks.length - 1; i >= 0; i--) s.masks[i]!.mask.restore(s.masks[i]!.before);
    this.host.apply(s.before);
  }
  private redoStep(s: Step): void {
    for (const t of s.tiles) t.raster.restoreTile(t.key, t.after);
    for (const m of s.masks) m.mask.restore(m.after);
    this.host.apply(s.after);
  }

  undo(): Step | null {
    if (!this.canUndo()) return null;
    const s = this.steps[--this.index]!;
    this.undoStep(s);
    this.host.changed(s, "undo");
    return s;
  }

  redo(): Step | null {
    if (!this.canRedo()) return null;
    const s = this.steps[this.index++]!;
    this.redoStep(s);
    this.host.changed(s, "redo");
    return s;
  }

  /** Go to the state after step `i` steps (0 = the opening state). */
  jump(i: number): void {
    i = Math.max(0, Math.min(this.steps.length, i));
    if (this.open || i === this.index) return;
    while (this.index > i) this.undoStep(this.steps[--this.index]!);
    while (this.index < i) this.redoStep(this.steps[this.index++]!);
    this.host.changed(null, "jump");
  }

  /** Memory held by undo data. */
  bytes(): number {
    return this.steps.reduce((n, s) => n + s.bytes, 0);
  }

  /** Drop the oldest steps past the step limit or the memory cap. */
  trim(): void {
    let drop = 0;
    if (this.limit > 0 && this.steps.length > this.limit) drop = this.steps.length - this.limit;
    let total = this.bytes();
    while (drop < this.index - 1 && total > this.memoryCap) total -= this.steps[drop++]!.bytes;
    if (drop > 0) { this.steps.splice(0, drop); this.index -= drop; }
  }

  clear(): void {
    this.steps = [];
    this.index = 0;
    this.host.changed(null, "clear");
  }

  /** Keep the current state as a named snapshot (pixel data shared copy-on-write). */
  snapshot(name: string): Snapshot {
    const state = this.host.capture();
    const { rasters, masks } = this.host.pixelData(state);
    const snap: Snapshot = { id: stepSeq++, name, at: Date.now(), state, rasters: new Map(), masks: new Map() };
    for (const r of rasters) snap.rasters.set(r, r.clone());
    for (const m of masks) { m.shared = true; snap.masks.set(m, m.data); }
    this.snapshots.push(snap);
    return snap;
  }

  /** Make a snapshot the current state (one undoable step). */
  revert(snapId: number): void {
    const snap = this.snapshots.find((s) => s.id === snapId);
    if (!snap) return;
    this.change(`Revert to ${snap.name}`, () => {
      for (const [live, copy] of snap.rasters) {
        for (const k of [...live.tiles.keys()]) if (!copy.tiles.has(k)) live.dropTile(keyTx(k), keyTy(k));
        for (const [k, t] of copy.tiles) live.tileForWrite(keyTx(k), keyTy(k)).set(t as never);
        live.ox = copy.ox; live.oy = copy.oy;
      }
      for (const [m, data] of snap.masks) m.writable().set(data);
      this.host.apply(snap.state);
    }, "snapshot");
  }

  /**
   * A layer raster as it was in the brush source state (history brush, art history brush). `find` picks the raster
   * of the wanted layer out of a captured state.
   */
  sourceRaster(find: (state: State) => TiledRaster | null): TiledRaster | null {
    const src = this.brushSource;
    if (src?.snapshot != null) {
      const snap = this.snapshots.find((s) => s.id === src.snapshot);
      if (!snap) return null;
      const r = find(snap.state);
      return r ? snap.rasters.get(r) ?? null : null;
    }
    const target = src?.step ?? 0;
    const state = target === 0 ? (this.steps[0]?.before ?? this.host.capture()) : this.steps[target - 1]!.after;
    const r = find(state);
    if (!r) return null;
    const out = r.clone();
    // walk back from now to the target step for this raster
    for (let i = this.index - 1; i >= target; i--) for (const t of this.steps[i]!.tiles) if (t.raster === r) out.restoreTile(t.key, t.before);
    for (let i = this.index; i < target; i++) for (const t of this.steps[i]!.tiles) if (t.raster === r) out.restoreTile(t.key, t.after);
    return out;
  }
}

/** Structural equality of two captured states (pixel data compared by reference). */
export function sameState(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return a !== a && b !== b;
  if (ArrayBuffer.isView(a) || a instanceof TiledRaster || a instanceof Mask) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameState(a[i]!, b[i]!)) return false;
    return true;
  }
  const ka = Object.keys(a as object), kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!sameState((a as Record<string, unknown>)[k]!, (b as Record<string, unknown>)[k]!)) return false;
  return true;
}

/** Deep copy of plain data; rasters, masks and typed arrays stay shared. */
export function cloneState<T>(v: T): T {
  if (typeof v !== "object" || v === null) return v;
  if (v instanceof TiledRaster || v instanceof Mask || ArrayBuffer.isView(v)) return v;
  if (Array.isArray(v)) return v.map(cloneState) as T;
  const o: Record<string, unknown> = {};
  for (const k of Object.keys(v as object)) o[k] = cloneState((v as Record<string, unknown>)[k]!);
  return o as T;
}
