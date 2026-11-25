// The image document: size, resolution, color mode, bit depth and profile; the layer tree; selection, channels,
// paths, guides, slices, notes, counts, color samplers and data sets. Every change runs inside doc.change() (one history
// step). Listeners hear "change" with the region to redraw.

import { History, cloneState, type State, type Step } from "./history.ts";
import {
  baseLayer, isContainer, hasRaster, newId, walk,
  type AdjustmentLayer, type ArtboardLayer, type ContainerLayer, type FillLayer, type GroupLayer, type Layer, type Paint,
  type PixelLayer, type RGBA, type ShapeLayer, type SmartLayer, type TextLayer,
} from "./layers.ts";
import { Mask, TiledRaster, TILE, rectUnion, type BitDepth, type Rect } from "./tiles.ts";
import type { PathData } from "./paths.ts";
import type { GlobalLight } from "./styles.ts";
import type { TextData } from "./text-model.ts";

/** Color mode. CMYK is edited as RGB with a CMYK soft proof. @tr Renk kipi. */
export type ColorMode = "rgb" | "gray" | "cmyk" | "lab" | "bitmap" | "indexed";

export interface AlphaChannel { id: string; name: string; mask: Mask; visible: boolean; color: RGBA; opacity: number; /** spot color channel */ spot?: boolean }
export interface PathItem { id: string; name: string; path: PathData; /** the unsaved "Work Path" */ work?: boolean }
export interface Guide { id: string; axis: "x" | "y"; pos: number; color?: RGBA | undefined; locked?: boolean | undefined; /** artboard id */ board?: string }
export interface Slice { id: string; name: string; rect: Rect; kind: "user" | "layer" | "auto"; layerId?: string | undefined; url?: string | undefined; alt?: string | undefined; format?: "png" | "jpeg" | "webp" | "avif" | undefined; quality?: number }
export interface Note { id: string; x: number; y: number; author: string; text: string; color: RGBA; at: number }
export interface CountGroup { id: string; name: string; color: RGBA; points: [number, number][]; size: number; visible: boolean }
export interface Sampler { id: string; x: number; y: number; size: 1 | 3 | 5 | 11 | 31 | 51 | 101; space: "rgb" | "hsb" | "lab" | "cmyk" | "gray" }
export interface DataSet { id: string; name: string; values: Record<string, string | boolean> }
export interface Grid { every: number; subdivisions: number; color: RGBA; style: "lines" | "dashed" | "dots"; visible: boolean }

export interface DocInit {
  /** Width in pixels. @tr Piksel genişlik. */
  width: number;
  /** Height in pixels. @tr Piksel yükseklik. */
  height: number;
  name?: string | undefined;
  /** Pixels per inch. */
  dpi?: number | undefined;
  mode?: ColorMode | undefined;
  depth?: BitDepth | undefined;
  /** ICC profile name ("sRGB IEC61966-2.1", "Display P3", "Adobe RGB (1998)", "ProPhoto RGB", "Gray Gamma 2.2"…). */
  profile?: string | undefined;
  /** Background contents: white, black, a color, or transparent. */
  background?: "white" | "black" | "transparent" | RGBA | undefined;
}

export interface DocChange {
  /** The region to redraw (document pixels); null = everything. */
  dirty: Rect | null;
  /** The layer tree, a layer's properties or the document's settings changed (panels redraw). */
  structure: boolean;
  step?: Step | null | undefined;
  how?: "do" | "undo" | "redo" | "jump" | "clear" | "live" | undefined;
}

type Listener = (c: DocChange) => void;

/** Fields of the document captured by the history (besides the layer tree). */
const DOC_FIELDS = ["name", "width", "height", "dpi", "mode", "depth", "profile", "activeId", "selected", "channels", "paths", "guides", "slices", "notes", "counts", "samplers", "dataSets", "grid", "globalLight", "meta", "selection", "quickMask", "proof"] as const;

export class ImageDocument {
  id = newId("d");
  name = "Untitled";
  width: number;
  height: number;
  dpi = 72;
  mode: ColorMode = "rgb";
  depth: BitDepth = 8;
  profile = "sRGB IEC61966-2.1";
  /** Root layers, bottom first. */
  layers: Layer[] = [];
  activeId: string | null = null;
  /** Layers selected in the Layers panel (multi-select). */
  selected: string[] = [];
  /** The pixel selection (null = none). */
  selection: Mask | null = null;
  /** Quick mask mode: the selection is edited as a red overlay. */
  quickMask = false;
  channels: AlphaChannel[] = [];
  paths: PathItem[] = [];
  guides: Guide[] = [];
  grid: Grid = { every: 64, subdivisions: 4, color: [0.5, 0.6, 1, 0.5], style: "lines", visible: false };
  slices: Slice[] = [];
  notes: Note[] = [];
  counts: CountGroup[] = [];
  samplers: Sampler[] = [];
  dataSets: DataSet[] = [];
  globalLight: GlobalLight = { angle: 120, altitude: 30 };
  /** Soft proof (View › Proof Setup): a profile name and the gamut warning switch. */
  proof: { profile: string; on: boolean; gamutWarning: boolean; intent: "perceptual" | "relative" | "saturation" | "absolute" } = { profile: "Coated FOGRA39", on: false, gamutWarning: false, intent: "relative" };
  meta: Record<string, unknown> = {};
  history: History;
  /** Saved since the last change (autosave and the tab dot read it). */
  dirtySinceSave = false;
  private listeners = new Set<Listener>();
  private pendingDirty: Rect | null | undefined = undefined;
  private pendingStructure = false;

  constructor(init: DocInit) {
    this.width = Math.max(1, Math.round(init.width));
    this.height = Math.max(1, Math.round(init.height));
    if (init.name) this.name = init.name;
    if (init.dpi) this.dpi = init.dpi;
    if (init.mode) this.mode = init.mode;
    if (init.depth) this.depth = init.depth;
    if (init.profile) this.profile = init.profile;
    this.history = new History({
      capture: () => this.capture(),
      apply: (s) => this.applyState(s),
      pixelData: (s) => this.pixelData(s),
      changed: (step, how) => this.afterHistory(step, how),
    });
    const bg = init.background ?? "white";
    if (bg !== "transparent") {
      const color: RGBA = bg === "white" ? [1, 1, 1, 1] : bg === "black" ? [0, 0, 0, 1] : bg;
      const l = this.newPixelLayer("Background");
      l.raster.fill({ x: 0, y: 0, w: this.width, h: this.height }, color);
      l.locks.position = true;
      l.data = { background: true };
      this.layers.push(l);
      this.activeId = l.id;
      this.selected = [l.id];
    }
  }

  get bounds(): Rect { return { x: 0, y: 0, w: this.width, h: this.height }; }

  // ——— events ———

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Mark a region to redraw (null = all) and notify listeners (live = while a stroke or drag is in progress). */
  invalidate(rect: Rect | null, structure = false, live = false): void {
    for (const fn of this.listeners) fn({ dirty: rect, structure, how: live ? "live" : undefined });
  }

  // ——— history ———

  /** Run fn as one undoable step. */
  change<T>(label: string, fn: () => T, kind?: string): T {
    return this.history.change(label, fn, kind);
  }
  begin(label: string, kind?: string): void { this.history.begin(label, kind); }
  commit(label?: string): Step | null { return this.history.commit(label); }
  cancel(): void { this.history.cancel(); }
  undo(): Step | null { return this.history.undo(); }
  redo(): Step | null { return this.history.redo(); }

  private capture(): State {
    const s: State = { layers: cloneState(this.layers) };
    for (const k of DOC_FIELDS) s[k] = cloneState((this as unknown as Record<string, unknown>)[k]!);
    const pos: [TiledRaster, number, number][] = [];
    for (const [l] of walk(this.layers)) if (hasRaster(l)) pos.push([l.raster, l.raster.ox, l.raster.oy]);
    s.rasterPos = pos;
    return s;
  }

  private applyState(s: State): void {
    this.layers = cloneState(s.layers as Layer[]);
    for (const k of DOC_FIELDS) (this as unknown as Record<string, unknown>)[k] = cloneState(s[k]!);
    for (const [r, ox, oy] of s.rasterPos as [TiledRaster, number, number][]) { r.ox = ox; r.oy = oy; }
  }

  private pixelData(s: State): { rasters: TiledRaster[]; masks: Mask[] } {
    const rasters: TiledRaster[] = [], masks: Mask[] = [];
    const seen = new Set<unknown>();
    const visit = (v: unknown): void => {
      if (typeof v !== "object" || v === null || seen.has(v)) return;
      seen.add(v);
      if (v instanceof TiledRaster) { rasters.push(v); return; }
      if (v instanceof Mask) { masks.push(v); return; }
      if (ArrayBuffer.isView(v)) return;
      for (const x of Array.isArray(v) ? v : Object.values(v)) visit(x);
    };
    visit(s);
    return { rasters, masks };
  }

  private afterHistory(step: Step | null, how: DocChange["how"]): void {
    this.dirtySinceSave = true;
    let dirty: Rect | null = null;
    let structure = !step || !step.tiles.length || how !== "do";
    if (step) {
      for (const t of step.tiles) {
        const tx = Math.floor(t.key / 65536) - 32768, ty = (t.key % 65536) - 32768;
        dirty = rectUnion(dirty, { x: tx * TILE + t.raster.ox, y: ty * TILE + t.raster.oy, w: TILE, h: TILE });
      }
      if (step.masks.length) dirty = null;
      if (!sameShallow(step.before.layers, step.after.layers) || DOC_FIELDS.some((k) => !sameShallow(step.before[k]! ?? null, step.after[k]! ?? null))) { structure = true; dirty = null; }
    } else dirty = null;
    for (const fn of this.listeners) fn({ dirty, structure, step, how });
  }

  // ——— layer lookup ———

  find(id: string | null | undefined): Layer | null {
    if (!id) return null;
    for (const [l] of walk(this.layers)) if (l.id === id) return l;
    return null;
  }
  get active(): Layer | null { return this.find(this.activeId); }

  /** The array holding a layer and its index there. */
  locate(id: string): { list: Layer[]; index: number; parent: ContainerLayer | null } | null {
    const search = (list: Layer[], parent: ContainerLayer | null): ReturnType<ImageDocument["locate"]> => {
      for (let i = 0; i < list.length; i++) {
        if (list[i]!.id === id) return { list, index: i, parent };
        const l = list[i]!;
        if (isContainer(l)) { const r = search(l.children, l); if (r) return r; }
      }
      return null;
    };
    return search(this.layers, null);
  }

  /** All layers, bottom first, depth first. */
  all(): Layer[] { return [...walk(this.layers)].map(([l]) => l); }

  /** Visible including every parent. */
  visibleInTree(id: string): boolean {
    let loc = this.locate(id);
    if (!loc || !loc.list[loc.index]!.visible) return false;
    while (loc && loc.parent) {
      if (!loc.parent.visible) return false;
      loc = this.locate(loc.parent.id);
    }
    return true;
  }

  // ——— factories (not yet in the tree) ———

  newPixelLayer(name = "Layer"): PixelLayer {
    return { ...baseLayer("pixel", name), raster: new TiledRaster(this.depth) };
  }
  newGroup(name = "Group"): GroupLayer { return { ...baseLayer("group", name), children: [], collapsed: false }; }
  newFillLayer(paint: Paint, name = "Fill"): FillLayer { return { ...baseLayer("fill", name), paint }; }
  newAdjustment(id: string, params: Record<string, unknown>, name = id): AdjustmentLayer {
    return { ...baseLayer("adjustment", name), adjust: { id, params } };
  }
  newShape(path: PathData, paint: Paint | null, name = "Shape"): ShapeLayer {
    return { ...baseLayer("shape", name), path, fillPaint: paint, stroke: null, raster: new TiledRaster(this.depth) };
  }
  newText(text: TextData, name = "Text"): TextLayer { return { ...baseLayer("text", name), text, raster: new TiledRaster(this.depth) }; }
  newArtboard(rect: Rect, name = "Artboard"): ArtboardLayer {
    return { ...baseLayer("artboard", name), rect, background: [1, 1, 1, 1], children: [], collapsed: false, blend: "pass-through" };
  }
  newSmart(source: SmartLayer["source"], matrix: number[], name = "Smart Object"): SmartLayer {
    return { ...baseLayer("smart", name), source, matrix, filters: [], filtersEnabled: true, raster: new TiledRaster(this.depth) };
  }

  // ——— tree changes (call inside change()) ———

  /** Insert a layer above the active one (or at the top of `parent`), make it active. */
  add<L extends Layer>(layer: L, opts: { above?: string | null | undefined; parent?: string | null | undefined; index?: number } = {}): L {
    let list = this.layers, index = list.length;
    const ref = opts.above !== undefined ? opts.above : this.activeId;
    if (opts.parent) {
      const p = this.find(opts.parent);
      if (p && isContainer(p)) { list = p.children; index = opts.index ?? list.length; }
    } else if (opts.index != null) index = opts.index;
    else if (ref) {
      const loc = this.locate(ref);
      if (loc) {
        const refLayer = loc.list[loc.index]!;
        if (isContainer(refLayer) && !refLayer.collapsed && opts.above === undefined && refLayer.kind === "artboard") { list = refLayer.children; index = list.length; }
        else { list = loc.list; index = loc.index + 1; }
      }
    }
    list.splice(index, 0, layer);
    this.activeId = layer.id;
    this.selected = [layer.id];
    return layer;
  }

  remove(ids: string[]): void {
    for (const id of ids) {
      const loc = this.locate(id);
      if (!loc) continue;
      loc.list.splice(loc.index, 1);
      if (this.activeId === id) {
        const next = loc.list[Math.min(loc.index, loc.list.length - 1)]! ?? loc.parent ?? this.layers[this.layers.length - 1]! ?? null;
        this.activeId = next?.id ?? null;
      }
    }
    this.selected = this.selected.filter((s) => this.find(s));
    if (this.activeId && !this.selected.includes(this.activeId)) this.selected = [this.activeId];
  }

  /** Move a layer to a new place: into a container (`parent`) at `index` (bottom = 0), or the root. */
  move(id: string, parent: string | null, index: number): void {
    const loc = this.locate(id);
    if (!loc) return;
    const layer = loc.list[loc.index]!;
    if (parent) {
      // a container cannot move into itself
      for (const [l] of walk([layer])) if (l.id === parent) return;
    }
    loc.list.splice(loc.index, 1);
    const target = parent ? (this.find(parent) as ContainerLayer | null)?.children ?? this.layers : this.layers;
    if (target === loc.list && index > loc.index) index--;
    target.splice(Math.max(0, Math.min(target.length, index)), 0, layer);
  }

  /** Raise / lower by one in its list (Ctrl+] / Ctrl+[), or to the top / bottom. */
  arrange(id: string, how: "up" | "down" | "top" | "bottom"): void {
    const loc = this.locate(id);
    if (!loc) return;
    const n = loc.list.length;
    const to = how === "up" ? Math.min(n - 1, loc.index + 1) : how === "down" ? Math.max(0, loc.index - 1) : how === "top" ? n - 1 : 0;
    if (to === loc.index) return;
    const [l] = loc.list.splice(loc.index, 1);
    loc.list.splice(to, 0, l!);
  }

  /** Copy a layer (pixels shared copy-on-write), placed above it. */
  duplicate(id: string, name?: string): Layer | null {
    const loc = this.locate(id);
    if (!loc) return null;
    const copy = deepCopyLayer(loc.list[loc.index]!);
    copy.name = name ?? `${loc.list[loc.index]!.name} copy`;
    loc.list.splice(loc.index + 1, 0, copy);
    this.activeId = copy.id;
    this.selected = [copy.id];
    return copy;
  }

  /** Put layers into a new group (Ctrl+G). */
  group(ids: string[], name = "Group"): GroupLayer | null {
    const locs = ids.map((id) => this.locate(id)).filter(Boolean) as NonNullable<ReturnType<ImageDocument["locate"]>>[];
    if (!locs.length) return null;
    const host = locs[locs.length - 1]!;
    const g = this.newGroup(name);
    const layers = locs.map((l) => l.list[l.index]!);
    const order = this.all().map((l) => l.id);
    layers.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    const at = host.list.indexOf(layers[layers.length - 1]!);
    host.list.splice(at + 1, 0, g);
    for (const l of layers) { const loc = this.locate(l.id)!; loc.list.splice(loc.index, 1); }
    g.children = layers;
    this.activeId = g.id;
    this.selected = [g.id];
    return g;
  }

  /** Move a group's children up into its place (Shift+Ctrl+G). */
  ungroup(id: string): void {
    const loc = this.locate(id);
    if (!loc) return;
    const g = loc.list[loc.index]!;
    if (!isContainer(g)) return;
    loc.list.splice(loc.index, 1, ...g.children);
    this.activeId = g.children[g.children.length - 1]?.id ?? null;
    this.selected = g.children.map((c) => c.id);
  }

  setActive(id: string | null, additive = false, range = false): void {
    if (!id) { this.activeId = null; this.selected = []; return; }
    if (range && this.activeId) {
      const order = this.all().map((l) => l.id);
      const a = order.indexOf(this.activeId), b = order.indexOf(id);
      this.selected = order.slice(Math.min(a, b), Math.max(a, b) + 1);
    } else if (additive) {
      this.selected = this.selected.includes(id) ? this.selected.filter((s) => s !== id) : [...this.selected, id];
    } else this.selected = [id];
    this.activeId = id;
  }

  /** Update layer fields (opacity, blend, visible, locks, name…). */
  set(id: string, patch: Partial<Layer>): void {
    const l = this.find(id);
    if (l) Object.assign(l, patch);
  }

  /** The bottom-most layer is the locked background layer. */
  isBackground(l: Layer): boolean { return !!l.data?.background && this.layers[0]! === l; }

  /** Turn the background into a normal layer (double click on it). */
  unlockBackground(): void {
    const l = this.layers[0]!;
    if (!l || !this.isBackground(l)) return;
    l.data = { ...l.data, background: false };
    l.locks.position = false;
    l.name = "Layer 0";
  }

  /** Total memory of pixel data (layers, masks, history). */
  memory(): { layers: number; history: number } {
    let layers = 0;
    for (const [l] of walk(this.layers)) {
      if (hasRaster(l)) layers += l.raster.bytes();
      if (l.mask) layers += l.mask.mask.data.byteLength;
    }
    return { layers, history: this.history.bytes() };
  }

  /** A unique layer name ("Layer 3"). */
  nextName(base = "Layer"): string {
    const used = new Set(this.all().map((l) => l.name));
    let i = 1;
    while (used.has(`${base} ${i}`)) i++;
    return `${base} ${i}`;
  }
}

/** Deep copy of a layer with new ids; pixel data shared copy-on-write. */
export function deepCopyLayer<L extends Layer>(l: L): L {
  const copy = cloneState(l);
  for (const [x] of walk([copy])) {
    x.id = newId();
    if (hasRaster(x)) x.raster = x.raster.clone();
    if (x.mask) x.mask = { ...x.mask, mask: x.mask.mask.clone() };
  }
  return copy;
}

const refIds = new WeakMap<object, number>();
let refSeq = 0;
const refId = (o: object): number => { let n = refIds.get(o); if (n == null) refIds.set(o, (n = ++refSeq)); return n; };
/** Same structure (pixel data compared by identity, not content). */
function sameShallow(a: unknown, b: unknown): boolean {
  const rep = (_k: string, v: unknown): unknown => (v instanceof TiledRaster || v instanceof Mask || ArrayBuffer.isView(v) ? `#${refId(v as object)}` : v);
  return JSON.stringify(a, rep) === JSON.stringify(b, rep);
}
