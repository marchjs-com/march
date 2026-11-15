// DirtyStateManager: which parts of the app hold unsaved changes, and a warning before they are lost — closing or
// reloading the tab (beforeunload) and leaving the page in the router (one confirmation for all of them).
//
//   import { dirtyState } from "march/managers/dirty";
//   const d = dirtyState();
//   d.track("profile", () => form.dirty(), "Profile form")   // reactive source; removed with the component
//   d.mark("draft", "Draft note")   d.clean("draft")           // or set by hand
//   d.any()   d.list()   await d.confirmLeave()   d.saveAll()   // saveAll runs each entry's save()
//   d.track("doc", () => !undoStack().atSaved(), "Document")    // with the undo history
import { signal, computed, effect, untrack, createRoot, getOwner, onCleanup, type Accessor } from "../../core/reactive.ts";
import { t, messages } from "../../core/i18n.ts";
import { on } from "../../core/util.ts";
import { beforeLeave } from "../../router/extras.ts";
import { confirm } from "../../ui/dialog.ts";
import { defineManager } from "../manager.ts";
import { publisher } from "../publish.ts";
import tr from "./tr.ts";

messages("tr", tr);

export interface DirtyEntry { id: string; label: string; dirty: () => boolean; save?: () => unknown }

export interface DirtyConfig {
  /** Ask the browser to warn before closing / reloading while something is dirty. Default true. */
  warnOnUnload: boolean;
  /** Ask before a router navigation while something is dirty. Default true. */
  guardRoutes: boolean;
  /** The leave question; gets the dirty entries. Default: a confirm dialog listing them. */
  confirm: ((items: DirtyEntry[]) => boolean | Promise<boolean>) | null;
}

export interface DirtyState {
  /** Watch a reactive source. Returns off (also removed with the current owner). */
  track(id: string, dirty: () => boolean, label?: string, save?: () => unknown): () => void;
  /** Mark dirty by hand (until clean()). */
  mark(id: string, label?: string, save?: () => unknown): void;
  clean(id: string): void;
  /** Something is dirty. */
  any(): boolean;
  /** The dirty entries. */
  list: Accessor<DirtyEntry[]>;
  is(id: string): boolean;
  /** Ask whether to leave (true at once when nothing is dirty). */
  confirmLeave(): Promise<boolean>;
  /** Run save() of every dirty entry that has one; returns how many ran. */
  saveAll(): Promise<number>;
  dispose(): void;
}

const pub = publisher("dirty");

function create(cfg: DirtyConfig): DirtyState {
  const entries = signal<DirtyEntry[]>([], { name: "dirty.entries" });
  const list = computed(() => entries().filter((e) => e.dirty()));
  const any = (): boolean => list().length > 0;
  const offs: (() => void)[] = [];
  const marked = new Set<string>();

  const add = (e: DirtyEntry): (() => void) => {
    entries.update((l) => [...l.filter((x) => x.id !== e.id), e]);
    return () => { entries.update((l) => l.filter((x) => x !== e)); };
  };
  // report every change of the dirty set (own root: stopped by dispose)
  createRoot((stop) => {
    offs.push(stop);
    let prev = "";
    effect(() => {
      const ids = list().map((e) => e.id);
      const key = ids.join(",");
      if (key === prev) return;
      prev = key;
      untrack(() => pub("change", { dirty: ids.length > 0, ids }));
    });
  });

  async function confirmLeave(): Promise<boolean> {
    const items = untrack(list);
    if (!items.length) return true;
    const ok = cfg.confirm
      ? await cfg.confirm(items)
      : await confirm({ title: t`Leave without saving?`, message: t`Unsaved changes: ${items.map((i) => i.label).join(", ")}`, ok: t`Leave`, cancel: t`Stay`, danger: true });
    pub(ok ? "leave" : "stay", { ids: items.map((e) => e.id) });
    return ok;
  }

  if (cfg.warnOnUnload) offs.push(on<BeforeUnloadEvent>(globalThis as unknown as EventTarget, "beforeunload", (e) => {
    if (!untrack(any)) return;
    pub("unload-warning");
    e.preventDefault();
    e.returnValue = "";
  }));
  if (cfg.guardRoutes) offs.push(beforeLeave(() => !untrack(any) || confirmLeave()));

  const state: DirtyState = {
    track(id, dirty, label = id, save) {
      const off = add({ id, label, dirty: computed(dirty), ...(save ? { save } : {}) });
      if (getOwner()) onCleanup(off);
      return off;
    },
    mark(id, label = id, save) {
      marked.add(id);
      add({ id, label, dirty: () => true, ...(save ? { save } : {}) });
    },
    /** Remove a mark() entry (tracked sources clean themselves). */
    clean(id) { if (marked.delete(id)) entries.update((l) => l.filter((x) => x.id !== id)); },
    any,
    list,
    is: (id) => list().some((e) => e.id === id),
    confirmLeave,
    async saveAll() {
      let n = 0;
      for (const e of untrack(list)) if (e.save) { await e.save(); n++; if (marked.has(e.id)) state.clean(e.id); }
      pub("save-all", { count: n });
      return n;
    },
    dispose() { for (const off of offs.splice(0)) off(); },
  };
  return state;
}

const manager = defineManager<DirtyState, DirtyConfig>("dirty", create, { warnOnUnload: true, guardRoutes: true, confirm: null });

/** The unsaved-changes manager (created on first call). */
export const dirtyState = (): DirtyState => manager.get();
/** Set the dirty-state manager's options (merged into the current config). */
export const configureDirty = (config: Partial<DirtyConfig>): void => manager.configure(config);
/** Stop the dirty-state manager and remove its listeners; the next call starts it again. */
export const disposeDirty = (): void => manager.dispose();
/** The dirty-state manager (get, configure, dispose). */
export const dirtyManager = manager;
