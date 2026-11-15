// CommandManager: one registry of user commands. The command palette, menus, context menus, toolbars and buttons all
// show the same entry, with the same permission, availability, busy state and shortcut.
//
//   import { command, commands } from "march/managers/command";
//   const save = command({
//     id: "doc.save", title: () => t`Save`, icon: saveIcon, shortcut: "mod+s", group: "File",
//     can: "docs.edit",                          // permission: hidden everywhere when it fails
//     when: () => $dirty,                        // availability: shown but disabled when false
//     run: async ({ signal }) => api.save(doc, { signal }),   // async, cancellable (save.cancel())
//   });
//   save.busy()   save.run()   commands.run("doc.save")   commands.conflicts()
//   <button command:doc.save>Save</button>      <CommandButton command="doc.save" />    (./ui)
//   <Menu items={commandItems({ group: "File" })} />                                     (./ui)
//
// Commands appear in <CommandPalette> automatically (palette: false to opt out). Shortcuts are only checked for
// conflicts here; bindCommandKeys() (./ui) binds them. onCommandRun() is the history hook (undo / redo, audit).
import { signal, computed, effect, untrack, getOwner, onCleanup, DEV, type Accessor } from "../../core/reactive.ts";
import { registerNamespace } from "../../dom/h.ts";
import { can as canAccess, type PermCheck } from "../../access/index.ts";
import { registerCommands, type CommandEntry } from "../../ui/registry.ts";
import { parseKey } from "../../ui/keys.ts";
import { defineManager, emit } from "../manager.ts";

type Text = string | (() => string);
const read = (v: Text): string => (typeof v === "function" ? v() : v);

/** What run() receives besides the arguments. */
export interface CommandContext {
  id: string;
  /** The run() arguments (also passed after the context, typed). */
  args: readonly unknown[];
  /** Aborted by cancel(), by a restart, or when the manager is disposed. Pass it to fetch(). */
  signal: AbortSignal;
}

/** A second run while one is going: ignore it (default), cancel the first and restart, or run both. */
export type Concurrency = "ignore" | "restart" | "parallel";

export interface CommandSpec<A extends unknown[] = unknown[], R = unknown> {
  /** Unique id ("doc.save"). Registering the same id again replaces the older command. */
  id: string;
  title: Text;
  description?: Text;
  icon?: unknown;
  /** Shortcut shown in menus and the palette ("mod+s"). Conflicts are reported by commands.conflicts(). */
  shortcut?: string;
  group?: string;
  keywords?: string;
  danger?: boolean;
  /** Permission (access/can). A command the user may not run is not shown anywhere. */
  can?: PermCheck;
  /** Availability right now (reactive): false = shown but disabled. */
  when?: (...args: A) => boolean;
  concurrency?: Concurrency;
  /** Listed in the command palette (default true). */
  palette?: boolean;
  run(ctx: CommandContext, ...args: A): R | Promise<R>;
}

/** A registered command. */
export interface Command<A extends unknown[] = unknown[], R = unknown> {
  readonly id: string;
  readonly spec: CommandSpec<A, R>;
  title(): string;
  /** Running now (reactive). */
  busy(): boolean;
  /** Permitted (reactive): `can` passes. */
  visible(): boolean;
  /** Can run now (reactive): visible, `when` passes and not busy (unless concurrency is "parallel"). */
  enabled(...args: A): boolean;
  /** Run it. Resolves to the result, or undefined when skipped, not permitted, unavailable or cancelled. Errors reject. */
  run(...args: A): Promise<R | undefined>;
  /** Abort every running call. */
  cancel(): void;
  /** Remove it from the registry. */
  dispose(): void;
}

/** One finished run, given to the history hook. */
export interface CommandRun { id: string; title: string; args: unknown[]; result: unknown; at: number }
/** Commands registered with the same shortcut. */
export interface ShortcutConflict { shortcut: string; ids: string[] }

export interface CommandConfig {
  /** List commands in <CommandPalette> (default true). */
  palette: boolean;
}

export interface CommandRegistry {
  register<A extends unknown[], R>(spec: CommandSpec<A, R>): Command<A, R>;
  get(id: string): Command | undefined;
  /** Every command (reactive), registration order. */
  list(): Command[];
  run(id: string, ...args: unknown[]): Promise<unknown>;
  conflicts(): ShortcutConflict[];
  onRun(fn: (run: CommandRun) => void): () => void;
  dispose(): void;
}

/** "mod+shift+k" → one canonical string for this platform. */
export const normalizeShortcut = (combo: string): string => {
  const k = parseKey(combo);
  return [k.ctrl && "ctrl", k.meta && "meta", k.alt && "alt", k.shift && "shift", k.key].filter(Boolean).join("+");
};

const isAbort = (e: unknown): boolean => (e as { name?: string } | null)?.name === "AbortError";

function create(cfg: CommandConfig): CommandRegistry {
  const all = signal<Command[]>([], { name: "commands" });
  const history = new Set<(r: CommandRun) => void>();
  const running = new Set<AbortController>();

  const conflicts = computed<ShortcutConflict[]>(() => {
    const by = new Map<string, string[]>();
    for (const c of all()) if (c.spec.shortcut) { const k = normalizeShortcut(c.spec.shortcut); by.set(k, [...(by.get(k) ?? []), c.id]); }
    return [...by].filter(([, ids]) => ids.length > 1).map(([shortcut, ids]) => ({ shortcut, ids }));
  });

  function register<A extends unknown[], R>(spec: CommandSpec<A, R>): Command<A, R> {
    const count = signal(0, { name: `command.${spec.id}.busy` });
    const mine = new Set<AbortController>();
    const visible = (): boolean => canAccess(spec.can);
    const busy = (): boolean => count() > 0;
    const enabled = (...args: A): boolean => visible() && (spec.when ? !!spec.when(...args) : true) && (spec.concurrency === "parallel" || !busy());
    const cancel = (): void => { for (const c of [...mine]) c.abort(); };
    const cmd: Command<A, R> = {
      id: spec.id,
      spec,
      title: () => read(spec.title),
      busy,
      visible,
      enabled,
      cancel,
      async run(...args: A): Promise<R | undefined> {
        if (!untrack(visible) || (spec.when && !untrack(() => spec.when?.(...args)))) return undefined;
        if (untrack(busy)) {
          const mode = spec.concurrency ?? "ignore";
          if (mode === "ignore") return undefined;
          if (mode === "restart") cancel();
        }
        const ctl = new AbortController();
        mine.add(ctl); running.add(ctl);
        count.update((n) => n + 1);
        emit("command", "run", { id: spec.id, args });
        try {
          const result = await spec.run({ id: spec.id, args, signal: ctl.signal }, ...args);
          if (ctl.signal.aborted) { emit("command", "cancel", { id: spec.id }); return undefined; }
          const entry: CommandRun = { id: spec.id, title: untrack(cmd.title), args, result, at: Date.now() };
          for (const fn of [...history]) fn(entry);
          emit("command", "done", { id: spec.id, result });
          return result;
        } catch (e) {
          if (ctl.signal.aborted || isAbort(e)) { emit("command", "cancel", { id: spec.id }); return undefined; }
          emit("command", "error", { id: spec.id, error: e });
          throw e;
        } finally {
          mine.delete(ctl); running.delete(ctl);
          count.update((n) => n - 1);
        }
      },
      dispose() {
        all.update((l) => l.filter((c) => c !== cmd));
      },
    };
    const prev = untrack(all).find((c) => c.id === spec.id);
    if (prev && DEV.enabled) DEV.warn(`command "${spec.id}" registered again: the newer one replaces it.`);
    all.update((l) => [...l.filter((c) => c.id !== spec.id), cmd as unknown as Command]);
    if (spec.shortcut && DEV.enabled) {
      const k = normalizeShortcut(spec.shortcut);
      const other = untrack(all).find((c) => c !== (cmd as unknown) && c.spec.shortcut && normalizeShortcut(c.spec.shortcut) === k);
      if (other) DEV.warn(`shortcut ${spec.shortcut} of "${spec.id}" is also used by "${other.id}".`);
    }
    emit("command", "register", { id: spec.id });
    if (getOwner()) onCleanup(cmd.dispose);
    return cmd;
  }

  // the existing palette reads its own registry: one accessor feeds it every listed, permitted command
  const offPalette = cfg.palette
    ? registerCommands(() => all().filter((c) => c.spec.palette !== false).map((c): CommandEntry => {
      const s = c.spec;
      const e: CommandEntry = { id: s.id, title: c.title, run: () => c.run().catch(() => {}), hidden: () => !c.enabled() };
      if (s.group) e.group = s.group;
      if (s.keywords) e.keywords = s.keywords;
      if (s.icon) e.icon = s.icon;
      if (s.shortcut) e.shortcut = s.shortcut;
      if (s.can) e.can = s.can;
      return e;
    }))
    : null;

  return {
    register,
    get: (id) => untrack(all).find((c) => c.id === id),
    list: () => all(),
    run: (id, ...args) => {
      const c = untrack(all).find((x) => x.id === id);
      if (!c) return Promise.reject(new Error(`March: no command "${id}".`));
      return c.run(...args);
    },
    conflicts,
    onRun(fn) {
      history.add(fn);
      const off = (): void => { history.delete(fn); };
      if (getOwner()) onCleanup(off);
      return off;
    },
    dispose() {
      for (const ctl of [...running]) ctl.abort();
      offPalette?.();
      all.set([]);
      history.clear();
    },
  };
}

const manager = defineManager<CommandRegistry, CommandConfig>("command", create, { palette: true });

/** Register a command (removed with the current owner, or call .dispose()). */
export function command<A extends unknown[] = [], R = unknown>(spec: CommandSpec<A, R>): Command<A, R> {
  return untrack(() => manager.get()).register(spec);
}
/** The registry: get, list, run by id, shortcut conflicts, history hook. */
export const commands = {
  get: (id: string): Command | undefined => manager.get().get(id),
  list: (): Command[] => manager.get().list(),
  run: (id: string, ...args: unknown[]): Promise<unknown> => manager.get().run(id, ...args),
  conflicts: (): ShortcutConflict[] => manager.get().conflicts(),
};
/** History hook: called after every successful run (undo / redo, audit log). Returns off. */
export const onCommandRun = (fn: (run: CommandRun) => void): (() => void) => manager.get().onRun(fn);
/** Global options of the command manager. */
export const configureCommands = (config: Partial<CommandConfig>): void => manager.configure(config);
/** Shut the command manager down; the next use starts it again. */
export const disposeCommands = (): void => manager.dispose();
/** The command manager (get, configure, dispose). */
export const commandManager = manager;

/** Commands picked by ids, a group, or a filter (reactive: only permitted ones). */
export type CommandPick = readonly string[] | { group: string } | ((c: Command) => boolean);
/** Commands picked by ids, a group or a filter (reactive: only the permitted ones). */
export function pickCommands(pick: CommandPick): Accessor<Command[]> {
  const f = (): Command[] => {
    const list = commands.list().filter((c) => c.visible());
    if (typeof pick === "function") return list.filter(pick);
    if (Array.isArray(pick)) return (pick as readonly string[]).map((id) => list.find((c) => c.id === id)).filter((c): c is Command => !!c);
    return list.filter((c) => c.spec.group === (pick as { group: string }).group);
  };
  return Object.assign(f, { peek: () => untrack(f) });
}

// command:id on an element: a click runs it; disabled + aria-busy follow its state; hidden when not permitted.
// `command:doc.save={[arg1, arg2]}` passes arguments.
registerNamespace("command", (el, id, value) => {
  const args = (): unknown[] => { const v = typeof value === "function" ? (value as () => unknown)() : value; return Array.isArray(v) ? v : []; };
  const cmd = (): Command | undefined => commands.list().find((c) => c.id === id);
  if (!untrack(cmd)) throw new Error(`March: command:${id} — no such command (register it before rendering).`);
  const b = el as HTMLButtonElement;
  b.addEventListener("click", () => { void untrack(cmd)?.run(...untrack(args)).catch(() => {}); });
  effect(() => {
    const c = cmd();
    b.hidden = !c || !c.visible();
    b.disabled = !c || !c.enabled(...args());
    if (c?.busy()) b.setAttribute("aria-busy", "true"); else b.removeAttribute("aria-busy");
    if (c?.spec.shortcut) b.setAttribute("aria-keyshortcuts", ariaKeys(c.spec.shortcut));
  });
});

/** "mod+shift+k" → "Control+Shift+K" (aria-keyshortcuts syntax, this platform). */
export const ariaKeys = (combo: string): string => {
  const k = parseKey(combo);
  const key = k.key.length === 1 ? k.key.toUpperCase() : k.key.charAt(0).toUpperCase() + k.key.slice(1);
  return [k.ctrl && "Control", k.meta && "Meta", k.alt && "Alt", k.shift && "Shift", key].filter(Boolean).join("+");
};
