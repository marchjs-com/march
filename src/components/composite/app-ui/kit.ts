// The plugin kit of march-app-ui (after HADİ Studio Kit's kit.js): a plugin adds file types (what opens a file: the code
// editor for .tsx…), panels, commands (the command palette finds them) and services other plugins use, and talks to the
// others through events. Everything a plugin adds goes away with it.
import { signal, untrack, type Signal } from "../../../core/reactive.ts";
import { command, type CommandSpec } from "../../../managers/command/index.ts";
import type { DockPanel } from "../dock-layout/index.ts";

/** A file shown in a panel: its path and text (reactive), and how to change it. */
export interface AppFile {
  path: string;
  text: () => string;
  set?: ((text: string) => void) | undefined;
}
/** What opens a kind of file: the first matching type with the highest priority draws it. */
export interface FileType {
  id: string;
  /** The paths it opens: a pattern or a test. */
  match: RegExp | ((path: string) => boolean);
  title?: string;
  /** Higher wins when two types match (default 0). */
  priority?: number;
  /** Draws the file (called once per panel; the text stays live through `file.text`). */
  mount: (file: AppFile) => unknown;
}
/** What a plugin gets in `activate`: every add returns a remover, and everything is removed with the plugin. */
export interface PluginContext {
  readonly id: string;
  fileType(type: FileType): () => void;
  panel(panel: DockPanel): () => void;
  /** A command (palette, shortcuts, menus): the command manager's spec. */
  command(spec: CommandSpec): () => void;
  /** Offer a service under a name (one per name). */
  provide(name: string, service: unknown): () => void;
  service<T = unknown>(name: string): T | undefined;
  on(event: string, fn: (data: unknown) => void): () => void;
  emit(event: string, data?: unknown): void;
  onDispose(fn: () => void): void;
}
/** A plugin: an id, the plugins it needs first, and `activate`; what activate returns runs when it is removed. */
export interface AppPlugin {
  id: string;
  title?: string;
  version?: string;
  /** Plugin ids that must be active first. */
  requires?: readonly string[];
  activate(ctx: PluginContext): void | (() => void);
}
/** Checks and returns a plugin definition (`definePlugin({ id, activate(ctx) { … } })`). */
export function definePlugin(p: AppPlugin): AppPlugin {
  if (!/^[a-z0-9][\w.-]*$/i.test(p.id)) throw new Error(`march-app-ui: plugin id "${p.id}" must be letters, digits, dots, dashes.`);
  if (typeof p.activate !== "function") throw new Error(`march-app-ui: plugin "${p.id}" needs activate(ctx).`);
  return Object.freeze({ ...p });
}

/** The running kit of an AppUI: what the plugins added. */
export interface AppKit {
  fileTypes: Signal<readonly FileType[]>;
  panels: Signal<readonly DockPanel[]>;
  /** The file type that opens a path, or null. */
  typeOf(path: string): FileType | null;
  service<T = unknown>(name: string): T | undefined;
  emit(event: string, data?: unknown): void;
  /** Start a plugin (its `requires` first); false when one is missing. */
  add(plugin: AppPlugin): boolean;
  remove(id: string): void;
  has(id: string): boolean;
  dispose(): void;
}

const matches = (t: FileType, path: string): boolean => (typeof t.match === "function" ? t.match(path) : t.match.test(path));

/** Makes the kit and starts `plugins` in order (each after the ones it requires). */
export function createAppKit(plugins: readonly AppPlugin[] = []): AppKit {
  const fileTypes = signal<readonly FileType[]>([]), panels = signal<readonly DockPanel[]>([]);
  const services = new Map<string, unknown>(), listeners = new Map<string, Set<(d: unknown) => void>>();
  const active = new Map<string, () => void>();
  const waiting = new Map<string, AppPlugin>();
  const listAdd = <T>(s: Signal<readonly T[]>, x: T): (() => void) => {
    s.set([...untrack(s), x]);
    return () => s.set(untrack(s).filter((y) => y !== x));
  };
  const emit = (event: string, data?: unknown): void => { for (const fn of [...(listeners.get(event) ?? [])]) { try { fn(data); } catch (e) { console.error(e); } } };
  function add(p: AppPlugin): boolean {
    if (active.has(p.id)) return true;
    if (!(p.requires ?? []).every((r) => active.has(r))) { waiting.set(p.id, p); return false; }
    waiting.delete(p.id);
    const offs: (() => void)[] = [];
    const own = (off: () => void): (() => void) => { offs.push(off); return off; };
    const ctx: PluginContext = {
      id: p.id,
      fileType: (t) => own(listAdd(fileTypes, t)),
      panel: (x) => own(listAdd(panels, x)),
      command: (spec) => { const c = command(spec); return own(() => c.dispose()); },
      provide: (name, svc) => {
        if (services.has(name)) console.warn(`march-app-ui: service "${name}" is provided again by "${p.id}"`);
        services.set(name, svc);
        return own(() => { if (services.get(name) === svc) services.delete(name); });
      },
      service: <T>(name: string) => services.get(name) as T | undefined,
      on: (event, fn) => {
        const set = listeners.get(event) ?? new Set();
        listeners.set(event, set); set.add(fn);
        return own(() => set.delete(fn));
      },
      emit,
      onDispose: (fn) => { offs.push(fn); },
    };
    try {
      const back = p.activate(ctx);
      if (typeof back === "function") offs.push(back);
    } catch (e) {
      for (const off of offs.reverse()) off();
      console.error(`march-app-ui: plugin "${p.id}" failed to start`, e);
      return false;
    }
    active.set(p.id, () => { for (const off of offs.reverse()) { try { off(); } catch (e) { console.error(e); } } });
    emit("plugin:added", p.id);
    // the ones waiting for this one
    for (const w of [...waiting.values()]) if (w.requires?.includes(p.id)) add(w);
    return true;
  }
  function remove(id: string): void {
    // the ones that need it go first
    for (const [other] of active) { const p = known.get(other); if (p?.requires?.includes(id)) remove(other); }
    active.get(id)?.();
    active.delete(id);
    emit("plugin:removed", id);
  }
  const known = new Map(plugins.map((p) => [p.id, p] as const));
  const kit: AppKit = {
    fileTypes, panels,
    typeOf: (path) => {
      let best: FileType | null = null;
      for (const t of fileTypes()) if (matches(t, path) && (!best || (t.priority ?? 0) > (best.priority ?? 0))) best = t;
      return best;
    },
    service: <T>(name: string) => services.get(name) as T | undefined,
    emit,
    add: (p) => { known.set(p.id, p); return add(p); },
    remove,
    has: (id) => active.has(id),
    dispose: () => { for (const id of [...active.keys()].reverse()) remove(id); waiting.clear(); },
  };
  for (const p of plugins) add(p);
  for (const p of waiting.values()) console.warn(`march-app-ui: plugin "${p.id}" waits for ${(p.requires ?? []).filter((r) => !active.has(r)).join(", ")}`);
  return kit;
}
