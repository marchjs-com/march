// UndoManager: one undo / redo history for the app, built on the command registry.
//
//   import { undoStack, undoCommands } from "hadi-march/managers/undo";
//   const u = undoStack();
//   u.push({ label: "Rename", undo: () => set(old), redo: () => set(next) });  // record a change already made
//   u.run("Delete row", () => remove(row), () => insert(row));               // do it now and record it
//   u.transaction("Paste 3 rows", () => { … several pushes … })             // one step
//   u.undo()  u.redo()  u.canUndo()  u.past()  u.future()  u.markSaved()  u.atSaved()
//
// Commands: a command whose run() returns { undo, redo? } is recorded automatically (its title is the label), and
// undoCommands() registers "edit.undo" (mod+z) and "edit.redo" (mod+shift+z) for the palette, menus and buttons.
// Recording starts with the first undoStack() / undoCommands() call.
// Typing-style changes merge: entries with the same `merge` key within `mergeMs` become one step.
import { signal, computed, untrack, batch, type Accessor } from "../../core/reactive.ts";
import { t, messages } from "../../core/i18n.ts";
import { defineManager } from "../manager.ts";
import { publisher } from "../publish.ts";
import { command, onCommandRun, type Command } from "../command/index.ts";
import tr from "./tr.ts";

messages("tr", tr);

/** One undoable step. `redo` defaults to running nothing (a pushed change that cannot be redone drops the redo side). */
export interface UndoEntry {
  label: string;
  undo: () => unknown;
  redo?: () => unknown;
  /** Entries with the same key pushed within `mergeMs` merge into one step (first undo, last redo). */
  merge?: string;
}
interface Step extends UndoEntry { at: number; id: number }

export interface UndoConfig {
  /** Steps kept (oldest dropped). Default 100. */
  limit: number;
  /** Merge window for entries with the same `merge` key (ms). Default 1000. */
  mergeMs: number;
  /** Record commands whose run() returns { undo }. Default true. */
  commands: boolean;
}

export interface UndoStack {
  push(entry: UndoEntry): void;
  /** Run `apply` now and record it with `revert` as its undo (apply is the redo). */
  run<R>(label: string, apply: () => R, revert: () => unknown, merge?: string): R;
  /** Every push inside fn becomes one step labelled `label` (undone in reverse order). */
  transaction<R>(label: string, fn: () => R): R;
  undo(): Promise<boolean>;
  redo(): Promise<boolean>;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Labels of the undoable steps, newest first. */
  past: Accessor<string[]>;
  /** Labels of the redoable steps, next first. */
  future: Accessor<string[]>;
  /** Remember this point as saved (DirtyState reads atSaved()). */
  markSaved(): void;
  /** The history is at the saved point. */
  atSaved(): boolean;
  clear(): void;
  dispose(): void;
}

const pub = publisher("undo");
const isEntry = (v: unknown): v is UndoEntry => !!v && typeof (v as UndoEntry).undo === "function";

function create(cfg: UndoConfig): UndoStack {
  const past = signal<Step[]>([], { name: "undo.past" });
  const future = signal<Step[]>([], { name: "undo.future" });
  const saved = signal<number>(0, { name: "undo.saved" }); // id of the step at the saved point (0 = empty)
  let ids = 0;
  let group: UndoEntry[] | null = null;
  let replaying = false;

  const top = (): number => past()[past().length - 1]?.id ?? 0;

  function push(entry: UndoEntry): void {
    if (replaying) return;
    if (group) { group.push(entry); return; }
    const now = Date.now();
    batch(() => {
      const list = untrack(past);
      const last = list[list.length - 1];
      if (entry.merge && last?.merge === entry.merge && now - last.at <= cfg.mergeMs && untrack(saved) !== last.id) {
        const merged: Step = { ...last, label: entry.label, at: now, ...(entry.redo ? { redo: entry.redo } : {}) };
        past.set([...list.slice(0, -1), merged]);
      } else {
        past.set([...list, { ...entry, at: now, id: ++ids }].slice(-cfg.limit));
      }
      future.set([]);
    });
    pub("push", { label: entry.label });
  }

  async function move(from: typeof past, to: typeof past, kind: "undo" | "redo"): Promise<boolean> {
    const list = untrack(from);
    const step = list[list.length - 1];
    if (!step) return false;
    batch(() => { from.set(list.slice(0, -1)); to.set([...untrack(to), step]); });
    replaying = true;
    try { await (kind === "undo" ? step.undo() : step.redo?.()); } finally { replaying = false; }
    pub(kind, { label: step.label });
    return true;
  }

  return {
    push,
    run(label, apply, revert, merge) {
      const r = apply();
      push({ label, undo: revert, redo: apply, ...(merge ? { merge } : {}) });
      return r;
    },
    transaction(label, fn) {
      if (group) return fn(); // nested: part of the outer step
      const steps: UndoEntry[] = [];
      group = steps;
      let r: ReturnType<typeof fn>;
      try { r = fn(); } finally { group = null; }
      if (steps.length) push({
        label,
        undo: async () => { for (const s of [...steps].reverse()) await s.undo(); },
        redo: async () => { for (const s of steps) await s.redo?.(); },
      });
      return r;
    },
    undo: () => move(past, future, "undo"),
    redo: () => move(future, past, "redo"),
    canUndo: () => past().length > 0,
    canRedo: () => future().length > 0,
    past: computed(() => past().map((s) => s.label).reverse()),
    future: computed(() => future().map((s) => s.label).reverse()),
    markSaved() { saved.set(untrack(top)); pub("saved"); },
    atSaved: () => top() === saved(),
    clear() { batch(() => { past.set([]); future.set([]); saved.set(0); }); pub("clear"); },
    dispose() { /* the command hook is removed by the manager wrapper */ },
  };
}

const manager = defineManager<UndoStack, UndoConfig>("undo", (cfg) => {
  const stack = create(cfg);
  // commands that return { undo, redo? } become steps; the command's title is the label
  const off = cfg.commands ? onCommandRun((r) => {
    if (r.id === "edit.undo" || r.id === "edit.redo" || !isEntry(r.result)) return;
    const e = r.result;
    stack.push({ label: e.label || r.title, undo: e.undo, ...(e.redo ? { redo: e.redo } : {}), ...(e.merge ? { merge: e.merge } : {}) });
  }) : null;
  return { ...stack, dispose: () => off?.() };
}, { limit: 100, mergeMs: 1000, commands: true });

/** The app's undo history (created on first call). */
export const undoStack = (): UndoStack => manager.get();
export const configureUndo = (config: Partial<UndoConfig>): void => manager.configure(config);
export const disposeUndo = (): void => manager.dispose();
export const undoManager = manager;

/** Register "edit.undo" (mod+z) and "edit.redo" (mod+shift+z); removed with the current owner. */
export function undoCommands(group = "Edit"): [Command, Command] {
  const s = (): UndoStack => undoStack();
  untrack(s); // start recording now
  return [
    command({ id: "edit.undo", title: () => { const l = s().past()[0]; return l ? t`Undo: ${l}` : t`Undo`; }, shortcut: "mod+z", group, when: () => s().canUndo(), run: () => s().undo() }),
    command({ id: "edit.redo", title: () => { const l = s().future()[0]; return l ? t`Redo: ${l}` : t`Redo`; }, shortcut: "mod+shift+z", group, when: () => s().canRedo(), run: () => s().redo() }),
  ];
}
