// Undo history engine: past / future steps, merge window for typing, transactions, saved point. The app-wide
// UndoManager (./index.ts) is this engine on the command registry; an editor that undoes its own changes takes a
// separate one with undoHistory() — without the command registry or the managers channel.
//
//   const h = undoHistory({ mergeMs: 800 })
//   h.push({ label: "Typing", undo, redo, merge: "typing" })   h.undo()   h.redo()   h.canUndo()   h.past()
import { signal, computed, untrack, batch, type Accessor } from "../../core/reactive.ts";

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

/** An undo stack with the given config; `pub` reports its events (UndoManager wires it to its channel). */
export function create(cfg: UndoConfig, pub: (type: string, detail?: unknown) => void = () => {}): UndoStack {
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

/** A separate history with the same engine (merge window, transactions, saved point); events go nowhere. */
export const undoHistory = (config: Partial<UndoConfig> = {}): UndoStack => create({ limit: 100, mergeMs: 1000, commands: false, ...config });
