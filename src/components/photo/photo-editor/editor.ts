// The PhotoEditor's controller: open documents (tabs), the active tool and its options, foreground / background
// colors, preferences, workspaces, the command list (menus, palette, shortcuts read it), plugins and the scripting
// facade (`editor.doc.layers.add(…)`). The UI parts only draw this state and call its methods.

import { signal, computed, batch, untrack, type Signal } from "../../../core/reactive.ts";
import {
  ImageDocument, renderRegion, select, saveDocument, loadDocument, isMarchImage,
  type DocInit, type Layer, type RGBA, type Rect, type BlendMode,
} from "../../../image/doc/index.ts";
import { allTools, getTool, registerTool, toolDefaults, type Tool, type ToolContext } from "../../../image/doc/tools/tool.ts";

export type ScreenMode = "standard" | "full-menu" | "full";
export type Workspace = "essentials" | "photography" | "painting" | "design";

/** A command of the editor (menus, palette, shortcuts, context menus, actions recorder). */
export interface EditorCommand {
  id: string;
  /** English label (translated by the UI). */
  label: string;
  /** Menu path: "File", "Image/Adjustments", "Layer/New"… */
  menu?: string | undefined;
  /** Default shortcut ("mod+j", "shift+mod+n", "v"…); the user may remap it. */
  key?: string | undefined;
  icon?: unknown;
  run(ed: Editor, ...args: unknown[]): unknown;
  enabled?: ((ed: Editor) => boolean) | undefined;
  checked?: ((ed: Editor) => boolean) | undefined;
  /** Ends a menu group (a separator follows). */
  sep?: boolean | undefined;
  /** Not shown in menus (palette and keys only). */
  hidden?: boolean | undefined;
  keywords?: string | undefined;
}

export interface Prefs {
  /** Ruler and size units. */
  units: "px" | "in" | "cm" | "mm" | "pt" | "pc" | "%";
  /** Most history steps kept (0: no limit within the memory cap). */
  historyStates: number;
  /** History memory cap in MB. */
  historyMB: number;
  /** Interface brightness. */
  uiColor: "dark" | "darker" | "medium" | "light";
  /** High-contrast interface. */
  highContrast: boolean;
  /** Animations of the interface (panels, tools, handles, ants, dialogs). */
  motion: boolean;
  /** Marching ants speed (dash steps per second) and the selection edge color. */
  antsSpeed: number;
  /** Autosave interval in minutes (0: off). */
  autosave: number;
  /** Render with workers when available. */
  workers: boolean;
  /** Tile cache in MB. */
  cacheMB: number;
  /** Show the pixel grid above this zoom. */
  pixelGridAt: number;
  /** Zoom with the wheel (otherwise scroll; Ctrl/Alt + wheel zooms). */
  wheelZooms: boolean;
  /** Animated zoom. */
  animatedZoom: boolean;
  /** Language of the interface ("" = page language). */
  lang: string;
  /** Precise cursors (crosshair) / brush tip cursors. */
  cursors: "standard" | "precise" | "tip" | "tip-crosshair";
  /** Remapped shortcuts: command id → combo ("" = none). */
  keys: Record<string, string>;
  /** Transparency checkerboard size. */
  checker: "none" | "small" | "medium" | "large";
}

export const DEFAULT_PREFS: Prefs = {
  units: "px", historyStates: 100, historyMB: 1024, uiColor: "dark", highContrast: false, motion: true, antsSpeed: 12,
  autosave: 5, workers: true, cacheMB: 512, pixelGridAt: 8, wheelZooms: false, animatedZoom: true, lang: "",
  cursors: "tip", keys: {}, checker: "medium",
};

/** View state of one document (zoom, pan, rotation, overlays). */
export interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
  angle: number;
  rulers: boolean;
  guides: boolean;
  grid: boolean;
  snap: boolean;
  smartGuides: boolean;
  extras: boolean;
  pixelGrid: boolean;
  /** Proof colors (soft proof) on. */
  proof: boolean;
  gamut: boolean;
  /** Show the selection edge (Ctrl+H hides extras). */
  edges: boolean;
}
export const DEFAULT_VIEW: ViewState = { zoom: 1, panX: 0, panY: 0, angle: 0, rulers: true, guides: true, grid: false, snap: true, smartGuides: true, extras: true, pixelGrid: true, proof: false, gamut: false, edges: true };

/** One open document. */
export interface DocEntry {
  id: string;
  doc: ImageDocument;
  view: Signal<ViewState>;
  /** Bumps on every change (panels read it to redraw). */
  rev: Signal<number>;
  /** Bumps on structural changes only (layer tree, settings). */
  srev: Signal<number>;
  /** The region changed by the last change (null: all), for the canvas. */
  dirty: { rect: Rect | null; live: boolean }[];
  /** File name it was opened from / saved to. */
  file?: string | undefined;
  /** A saved-file handle (File System Access) when the platform has one. */
  handle?: unknown;
  /** Floating window instead of a tab. */
  floating: Signal<boolean>;
  off: () => void;
}

export interface PanelSpec { id: string; title: string; icon?: unknown; content: (ed: Editor) => unknown; place?: unknown }
export interface PluginApi {
  editor: Editor;
  addTool(tool: Tool): () => void;
  addCommand(cmd: EditorCommand): () => void;
  addPanel(panel: PanelSpec): () => void;
  /** Add a filter / adjustment to the engine (shown in Filter and Image › Adjustments). */
  addFilter(def: unknown): () => void;
  on(event: EditorEvent, fn: (data: unknown) => void): () => void;
}
export interface Plugin { id: string; name: string; setup(api: PluginApi): void | (() => void) }
export type EditorEvent = "doc:open" | "doc:close" | "doc:change" | "doc:active" | "tool" | "color" | "prefs" | "command";

const PREFS_KEY = "march.photo-editor.prefs";

function loadPrefs(): Prefs {
  try {
    const raw = globalThis.localStorage?.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : { ...DEFAULT_PREFS };
  } catch { return { ...DEFAULT_PREFS }; }
}

export class Editor {
  docs = signal<DocEntry[]>([]);
  activeId = signal<string | null>(null);
  tool = signal<string>("move");
  /** Option values per tool id. */
  toolOptions = signal<Record<string, Record<string, unknown>>>({});
  fg = signal<RGBA>([0, 0, 0, 1]);
  bg = signal<RGBA>([1, 1, 1, 1]);
  prefs = signal<Prefs>(loadPrefs());
  screenMode = signal<ScreenMode>("standard");
  /** Tab hides the panels and bars. */
  uiHidden = signal(false);
  workspace = signal<Workspace>("essentials");
  quickMask = signal(false);
  /** Shared tool state (clone source, brush preset, injected filters / AI hooks…). */
  shared: Record<string, unknown> = {};
  commands = new Map<string, EditorCommand>();
  /** Bumps when commands are added or removed. */
  commandsRev = signal(0);
  panels = signal<PanelSpec[]>([]);
  /** Last announcement (the UI's live region reads it). */
  said = signal("");
  /** Swatches (Swatches panel) and recent colors. */
  swatches = signal<RGBA[]>([]);
  recent = signal<RGBA[]>([]);
  /** Internal clipboard (pixels with their place, or a layer copy). */
  clip: { px: Float32Array; rect: Rect } | null = null;
  private listeners = new Map<EditorEvent, Set<(d: unknown) => void>>();
  private plugins = new Map<string, () => void>();
  private seq = 0;

  constructor() {
    this.swatches.set(DEFAULT_SWATCHES.map((c) => [...c] as RGBA));
  }

  // ——— events ———
  on(ev: EditorEvent, fn: (d: unknown) => void): () => void {
    let s = this.listeners.get(ev);
    if (!s) this.listeners.set(ev, (s = new Set()));
    s.add(fn);
    return () => s!.delete(fn);
  }
  emit(ev: EditorEvent, data?: unknown): void { for (const fn of this.listeners.get(ev) ?? []) fn(data); }

  // ——— documents ———
  readonly active = computed<DocEntry | null>(() => this.docs().find((d) => d.id === this.activeId()) ?? null);
  /** The active document (untracked convenience for commands). */
  get doc(): ImageDocument | null { return untrack(this.active)?.doc ?? null; }
  entry(id?: string | null): DocEntry | null { return untrack(this.docs).find((d) => d.id === (id ?? untrack(this.activeId))) ?? null; }

  /** Add a document as a new tab and make it active. */
  addDoc(doc: ImageDocument, file?: string): DocEntry {
    const p = untrack(this.prefs);
    doc.history.limit = p.historyStates;
    doc.history.memoryCap = p.historyMB * 1024 * 1024;
    const entry: DocEntry = {
      id: `doc${++this.seq}`, doc, view: signal({ ...DEFAULT_VIEW }), rev: signal(0), srev: signal(0), dirty: [], file,
      floating: signal(false), off: () => {},
    };
    entry.off = doc.on((c) => {
      entry.dirty.push({ rect: c.dirty, live: c.how === "live" });
      batch(() => {
        entry.rev.set(entry.rev.peek() + 1);
        if (c.structure) entry.srev.set(entry.srev.peek() + 1);
      });
      this.emit("doc:change", { entry, change: c });
    });
    batch(() => {
      this.docs.set([...untrack(this.docs), entry]);
      this.activeId.set(entry.id);
    });
    this.emit("doc:open", entry);
    return entry;
  }

  newDoc(init: DocInit): DocEntry {
    const doc = new ImageDocument({ name: init.name ?? this.untitled(), ...init });
    return this.addDoc(doc);
  }

  private untitled(): string {
    const used = new Set(untrack(this.docs).map((d) => d.doc.name));
    let i = 1;
    while (used.has(`Untitled-${i}`)) i++;
    return `Untitled-${i}`;
  }

  close(id: string): void {
    const list = untrack(this.docs), i = list.findIndex((d) => d.id === id);
    if (i < 0) return;
    list[i]!.off();
    const next = list.filter((d) => d.id !== id);
    batch(() => {
      this.docs.set(next);
      if (untrack(this.activeId) === id) this.activeId.set(next[Math.min(i, next.length - 1)]?.id ?? null);
    });
    this.emit("doc:close", id);
  }

  activate(id: string): void { this.activeId.set(id); this.emit("doc:active", id); }

  /** Open bytes (.march-image) or an image file (decoded by the platform). */
  async open(data: Uint8Array | Blob, name = "Image"): Promise<DocEntry | null> {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(await data.arrayBuffer());
    if (isMarchImage(bytes)) {
      const doc = await loadDocument(bytes);
      return this.addDoc(doc, name);
    }
    const open = this.shared.openFile as ((b: Uint8Array, name: string) => Promise<ImageDocument | null>) | undefined;
    if (open) { const d = await open(bytes, name); if (d) return this.addDoc(d, name); }
    const img = await decodeImage(bytes);
    if (!img) return null;
    const doc = new ImageDocument({ width: img.width, height: img.height, name: name.replace(/\.[^.]+$/, ""), background: "transparent" });
    const l = doc.newPixelLayer("Background");
    l.raster.write(0, 0, img.width, img.height, img.data);
    l.data = { background: true };
    l.locks.position = true;
    doc.layers.push(l);
    doc.activeId = l.id;
    doc.selected = [l.id];
    return this.addDoc(doc, name);
  }

  async save(id?: string): Promise<Uint8Array | null> {
    const e = this.entry(id);
    if (!e) return null;
    const bytes = await saveDocument(e.doc);
    e.doc.dirtySinceSave = false;
    e.srev.set(e.srev.peek() + 1);
    return bytes;
  }

  // ——— tools ———
  /** Switch tool; a tool in the same group remembers its last member. */
  setTool(id: string): void {
    const t = getTool(id);
    if (!t) return;
    const prev = getTool(untrack(this.tool));
    const ctx = this.toolContext();
    if (prev && prev.id !== id) {
      if (ctx && prev.pending?.(ctx)) prev.commit?.(ctx);
      if (ctx) prev.deactivate?.(ctx);
    }
    this.tool.set(id);
    if (ctx) t.activate?.(ctx);
    this.lastInGroup[t.group] = id;
    this.emit("tool", id);
    this.announce(t.label);
  }
  lastInGroup: Record<string, string> = {};

  options(id = untrack(this.tool)): Record<string, unknown> {
    const t = getTool(id);
    return { ...(t ? toolDefaults(t) : {}), ...(untrack(this.toolOptions)[id] ?? {}) };
  }
  setOption(key: string, value: unknown, id = untrack(this.tool)): void {
    const all = untrack(this.toolOptions);
    this.toolOptions.set({ ...all, [id]: { ...(all[id] ?? {}), [key]: value } });
  }

  /** The context a tool works with on the active document. */
  toolContext(): ToolContext | null {
    const e = untrack(this.active);
    if (!e) return null;
    const ed = this;
    const ctx: ToolContext = {
      doc: e.doc,
      get fg() { return untrack(ed.fg); },
      set fg(c) { ed.fg.set(c); },
      get bg() { return untrack(ed.bg); },
      set bg(c) { ed.bg.set(c); },
      get options() { return ed.options(); },
      set options(o) { ed.toolOptions.set({ ...untrack(ed.toolOptions), [untrack(ed.tool)]: o }); },
      zoom: untrack(e.view).zoom,
      invalidate: (rect) => e.doc.invalidate(rect, false, true),
      setColor: (w, c) => this.setColor(w, c),
      setOption: (k, v) => this.setOption(k, v),
      announce: (text) => this.announce(text),
      switchTool: (id) => this.setTool(id),
      shared: this.shared,
    };
    return ctx;
  }

  // ——— colors ———
  setColor(which: "fg" | "bg", c: RGBA): void {
    (which === "fg" ? this.fg : this.bg).set(c);
    const r = untrack(this.recent).filter((x) => x.some((v, i) => Math.abs(v - c[i]!) > 1e-3));
    this.recent.set([c, ...r].slice(0, 16));
    this.emit("color", { which, c });
  }
  swapColors(): void { batch(() => { const f = untrack(this.fg); this.fg.set(untrack(this.bg)); this.bg.set(f); }); }
  resetColors(): void { batch(() => { this.fg.set([0, 0, 0, 1]); this.bg.set([1, 1, 1, 1]); }); }

  // ——— prefs ———
  setPrefs(patch: Partial<Prefs>): void {
    const next = { ...untrack(this.prefs), ...patch };
    this.prefs.set(next);
    try { globalThis.localStorage?.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    for (const e of untrack(this.docs)) { e.doc.history.limit = next.historyStates; e.doc.history.memoryCap = next.historyMB * 1024 * 1024; e.doc.history.trim(); }
    this.emit("prefs", next);
  }
  /** The shortcut of a command (remapped or default). */
  keyOf(id: string): string | undefined {
    const k = untrack(this.prefs).keys[id];
    return k === undefined ? this.commands.get(id)?.key : k || undefined;
  }
  remap(id: string, combo: string): void { this.setPrefs({ keys: { ...untrack(this.prefs).keys, [id]: combo } }); }

  // ——— commands ———
  addCommand(...cmds: EditorCommand[]): () => void {
    for (const c of cmds) this.commands.set(c.id, c);
    this.commandsRev.set(untrack(this.commandsRev) + 1);
    return () => { for (const c of cmds) if (this.commands.get(c.id) === c) this.commands.delete(c.id); this.commandsRev.set(untrack(this.commandsRev) + 1); };
  }
  can(id: string): boolean {
    const c = this.commands.get(id);
    return !!c && (c.enabled ? c.enabled(this) : true);
  }
  run(id: string, ...args: unknown[]): unknown {
    const c = this.commands.get(id);
    if (!c || (c.enabled && !c.enabled(this))) return undefined;
    this.emit("command", { id, args });
    return c.run(this, ...args);
  }

  // ——— plugins ———
  use(p: Plugin): () => void {
    if (this.plugins.has(p.id)) return this.plugins.get(p.id)!;
    const offs: (() => void)[] = [];
    const api: PluginApi = {
      editor: this,
      addTool: (t) => { const off = registerTool(t); offs.push(off); return off; },
      addCommand: (c) => { const off = this.addCommand(c); offs.push(off); return off; },
      addPanel: (panel) => { this.panels.set([...untrack(this.panels), panel]); const off = (): void => { this.panels.set(untrack(this.panels).filter((x) => x !== panel)); }; offs.push(off); return off; },
      addFilter: (def) => { const reg = this.shared.registerFilter as ((d: unknown) => () => void) | undefined; const off = reg ? reg(def) : () => {}; offs.push(off); return off; },
      on: (ev, fn) => { const off = this.on(ev, fn); offs.push(off); return off; },
    };
    const teardown = p.setup(api);
    const off = (): void => { if (typeof teardown === "function") teardown(); for (const o of offs.reverse()) o(); this.plugins.delete(p.id); };
    this.plugins.set(p.id, off);
    return off;
  }

  // ——— helpers used by commands and panels ———
  announce(text: string): void { this.said.set(text); }

  /** Run fn as one undo step on the active document. */
  change<T>(label: string, fn: (doc: ImageDocument) => T): T | undefined {
    const d = this.doc;
    return d ? d.change(label, () => fn(d)) : undefined;
  }

  /** Copy the selected pixels of the active layer (or all of it) to the internal clipboard. */
  copy(merged = false): boolean {
    const d = this.doc;
    if (!d) return false;
    const r = d.selection?.bounds() ?? d.bounds;
    let px: Float32Array;
    if (merged) {
      px = renderRegion(d, r);
      for (let i = 0; i < px.length; i += 4) { const a = px[i + 3]!; if (a > 0) { px[i]! /= a; px[i + 1]! /= a; px[i + 2]! /= a; } }
    } else {
      const l = d.active;
      if (!l || !("raster" in l)) return false;
      px = l.raster.read(r.x, r.y, r.w, r.h);
    }
    if (d.selection) for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) px[(y * r.w + x) * 4 + 3]! *= d.selection.get(r.x + x, r.y + y) / 255;
    this.clip = { px, rect: r };
    return true;
  }

  /** Paste as a new layer (in place, or centered in the view). */
  paste(inPlace = true): Layer | null {
    const d = this.doc, c = this.clip;
    if (!d || !c) return null;
    return d.change("Paste", () => {
      const l = d.add(d.newPixelLayer(d.nextName()));
      const x = inPlace ? c.rect.x : Math.round((d.width - c.rect.w) / 2), y = inPlace ? c.rect.y : Math.round((d.height - c.rect.h) / 2);
      l.raster.write(x, y, c.rect.w, c.rect.h, c.px);
      return l;
    });
  }

  /** Delete / fill the selection on the active layer (Delete, Alt+Backspace, Ctrl+Backspace). */
  fillSelection(color: RGBA | null, mode: BlendMode = "normal", opacity = 1): void {
    const d = this.doc, l = d?.active;
    if (!d || !l || !("raster" in l) || l.locks.pixels) return;
    const r = d.selection?.bounds() ?? d.bounds;
    d.change(color ? "Fill" : "Clear", () => {
      const px = l.raster.read(r.x, r.y, r.w, r.h);
      for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
        const i = (y * r.w + x) * 4;
        const k = (d.selection ? d.selection.get(r.x + x, r.y + y) / 255 : 1) * opacity;
        if (k <= 0) continue;
        if (!color) { px[i + 3]! *= 1 - k; continue; }
        const keepA = l.locks.transparency ? px[i + 3]! : null;
        const a = px[i + 3]!, ao = k + a * (1 - k);
        for (let c = 0; c < 3; c++) px[i + c] = ao > 0 ? (color[c]! * k + px[i + c]! * a * (1 - k)) / ao : 0;
        px[i + 3] = keepA ?? ao;
      }
      void mode;
      l.raster.write(r.x, r.y, r.w, r.h, px);
    });
  }

  /** Scripting facade for plugins and the console: editor.doc.layers.add(…), editor.doc.select.all() … */
  get api(): ScriptApi { return scriptApi(this); }

  tools(): Tool[] { return allTools(); }
}

/** A friendly facade over the active document for scripts and plugins. */
export interface ScriptApi {
  doc: {
    readonly width: number; readonly height: number;
    layers: { list(): Layer[]; add(name?: string): Layer | undefined; get(id: string): Layer | null; remove(id: string): void; set(id: string, patch: Partial<Layer>): void };
    select: { all(): void; none(): void; rect(x: number, y: number, w: number, h: number): void; invert(): void; feather(r: number): void };
    undo(): void; redo(): void;
    fill(color: RGBA): void;
  } | null;
  run(id: string, ...args: unknown[]): unknown;
  newDocument(init: DocInit): void;
}

export function scriptApi(ed: Editor): ScriptApi {
  const d = ed.doc;
  return {
    run: (id, ...args) => ed.run(id, ...args),
    newDocument: (init) => { ed.newDoc(init); },
    doc: d ? {
      get width() { return d.width; },
      get height() { return d.height; },
      layers: {
        list: () => d.all(),
        add: (name) => d.change("New Layer", () => d.add(d.newPixelLayer(name ?? d.nextName()))),
        get: (id) => d.find(id),
        remove: (id) => d.change("Delete Layer", () => d.remove([id])),
        set: (id, patch) => d.change("Layer Properties", () => d.set(id, patch)),
      },
      select: {
        all: () => d.change("Select All", () => select.selectAll(d)),
        none: () => d.change("Deselect", () => select.deselect(d)),
        rect: (x, y, w, h) => d.change("Rectangular Marquee", () => select.combine(d, select.rectMask(d, { x, y, w, h }), "new")),
        invert: () => d.change("Inverse", () => select.invert(d)),
        feather: (r) => d.change("Feather", () => select.feather(d, r)),
      },
      undo: () => { d.undo(); },
      redo: () => { d.redo(); },
      fill: (c) => ed.fillSelection(c),
    } : null,
  };
}

/** Decode an image file to straight float RGBA (browser only: createImageBitmap + OffscreenCanvas). */
export async function decodeImage(bytes: Uint8Array): Promise<{ width: number; height: number; data: Float32Array } | null> {
  const g = globalThis as { createImageBitmap?: typeof createImageBitmap; OffscreenCanvas?: typeof OffscreenCanvas };
  if (!g.createImageBitmap || !g.OffscreenCanvas) return null;
  try {
    const bmp = await g.createImageBitmap(new Blob([bytes as BlobPart]), { premultiplyAlpha: "none", colorSpaceConversion: "default" } as ImageBitmapOptions);
    const c = new g.OffscreenCanvas(bmp.width, bmp.height);
    const x = c.getContext("2d")!;
    x.drawImage(bmp, 0, 0);
    const img = x.getImageData(0, 0, bmp.width, bmp.height);
    const f = new Float32Array(img.data.length);
    for (let i = 0; i < f.length; i++) f[i] = img.data[i]! / 255;
    return { width: bmp.width, height: bmp.height, data: f };
  } catch { return null; }
}

/** Default swatches: neutrals and a hue wheel in three lightnesses (made here). */
const DEFAULT_SWATCHES: RGBA[] = (() => {
  const out: RGBA[] = [];
  for (let i = 0; i <= 8; i++) out.push([i / 8, i / 8, i / 8, 1]);
  const hsl = (h: number, s: number, l: number): RGBA => {
    const k = (n: number): number => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n: number): number => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return [f(0), f(8), f(4), 1];
  };
  for (const l of [0.35, 0.55, 0.75]) for (let h = 0; h < 360; h += 30) out.push(hsl(h, 0.8, l));
  return out;
})();

/** Look up a tool and the editor's option values for it (UI helpers). */
export const toolOf = (ed: Editor): Tool | undefined => getTool(ed.tool());
