// Collection selection and cursor model: one home for "which items are selected" and "where is the keyboard cursor"
// in lists, grids and trees (Table, DataGrid, TreeView, FileManager). Headless, keyed, reactive.
//   createSelection() — single / multiple selection over an ordered key list: pick() follows the platform
//                       convention (click = only this, Ctrl/⌘ = toggle, Shift = range from the anchor).
//   moveCursor()      — next index for a navigation key in a list or a wrapped grid (arrows, Home/End, PageUp/Down).
import { signal, batch, untrack, type Signal } from "./reactive.ts";
import { val, type MaybeFn } from "./util.ts";

export type SelectionMode = "none" | "single" | "multiple";

export interface SelectionOptions<K, T = K> {
  /** Items in display order (range selection and select-all walk this list). */
  items: () => readonly T[];
  /** Key of an item (default: the item itself). */
  keyOf?: ((item: T) => K) | undefined;
  mode?: MaybeFn<SelectionMode | undefined>;
  /** Backing store: share an existing signal (e.g. a table's `selected`) instead of a new one. */
  store?: Signal<Map<K, T>> | undefined;
  initial?: Iterable<T> | undefined;
  /** Called after every change with the selected keys. */
  onChange?: ((keys: K[]) => void) | undefined;
}

/** What a pointer / key gesture does to the selection. */
export interface PickModifiers { shiftKey?: boolean | undefined; ctrlKey?: boolean | undefined; metaKey?: boolean | undefined }

export interface Selection<K, T = K> {
  /** key → item of every selected item, in selection order. */
  selected: Signal<Map<K, T>>;
  /** Key where the last single / toggle pick happened (start of a Shift range). */
  anchor: Signal<K | undefined>;
  mode(): SelectionMode;
  has(key: K): boolean;
  size(): number;
  keys(): K[];
  items(): T[];
  /** "none" | "some" | "all" of `items()`. */
  state(): "none" | "some" | "all";
  /** Replace the selection with these items. */
  set(items: Iterable<T>): void;
  /** Select (on = true), deselect (false) or flip (undefined) one item; moves the anchor. */
  toggle(item: T, on?: boolean): void;
  /**
   * Range from the anchor to `item` (inclusive). `add` keeps what was selected outside the range; `on = false`
   * deselects the range instead. Moves the anchor to `item` only with `move`.
   */
  range(item: T, add?: boolean, on?: boolean, move?: boolean): void;
  /** Platform gesture: plain = only this, Ctrl/⌘ = toggle, Shift = range (Ctrl+Shift adds the range). */
  pick(item: T, mods?: PickModifiers): void;
  selectAll(on?: boolean): void;
  clear(): void;
}

/** Keyed selection over an ordered collection. */
export function createSelection<K, T = K>(o: SelectionOptions<K, T>): Selection<K, T> {
  const keyOf = o.keyOf ?? ((x: T) => x as unknown as K);
  const selected = o.store ?? signal(new Map<K, T>());
  const anchor = signal<K | undefined>(undefined);
  const mode = (): SelectionMode => val(o.mode) ?? "multiple";
  const commit = (next: Map<K, T>): void => { selected.set(next); o.onChange?.([...next.keys()]); };
  if (o.initial) { const m = new Map<K, T>(); for (const it of o.initial) m.set(keyOf(it), it); selected.set(m); }
  const sel: Selection<K, T> = {
    selected, anchor, mode,
    has: (k) => selected().has(k),
    size: () => selected().size,
    keys: () => [...selected().keys()],
    items: () => [...selected().values()],
    state() {
      const all = o.items(), cur = selected();
      if (!cur.size || !all.length) return "none";
      let n = 0;
      for (const it of all) if (cur.has(keyOf(it))) n++;
      return n === 0 ? "none" : n === all.length ? "all" : "some";
    },
    set(items) {
      if (mode() === "none") return;
      const m = new Map<K, T>();
      for (const it of items) { m.set(keyOf(it), it); if (mode() === "single") break; }
      commit(m);
    },
    toggle(item, on) {
      const m = mode();
      if (m === "none") return;
      const k = keyOf(item), cur = untrack(selected), want = on ?? !cur.has(k);
      const next = m === "single" ? new Map<K, T>() : new Map(cur);
      if (want) next.set(k, item); else next.delete(k);
      batch(() => { anchor.set(k); commit(next); });
    },
    range(item, add = false, on = true, move = false) {
      if (mode() !== "multiple") { sel.toggle(item, on); return; }
      const list = untrack(o.items), a = untrack(anchor);
      const b = list.findIndex((x) => keyOf(x) === keyOf(item));
      const ai = a === undefined ? -1 : list.findIndex((x) => keyOf(x) === a);
      if (ai < 0 || b < 0) { sel.toggle(item, on); return; }
      const next = add || !on ? new Map(untrack(selected)) : new Map<K, T>();
      for (let i = Math.min(ai, b); i <= Math.max(ai, b); i++) { const it = list[i] as T; if (on) next.set(keyOf(it), it); else next.delete(keyOf(it)); }
      // by default the anchor stays: Shift+click again re-ranges from the same start
      batch(() => { if (move) anchor.set(keyOf(item)); commit(next); });
    },
    pick(item, mods = {}) {
      const multi = mode() === "multiple", ctrl = !!(mods.ctrlKey || mods.metaKey);
      if (multi && mods.shiftKey) sel.range(item, ctrl);
      else if (multi && ctrl) sel.toggle(item);
      else { const k = keyOf(item); batch(() => { anchor.set(k); commit(new Map([[k, item]])); }); }
    },
    selectAll(on = true) {
      if (mode() !== "multiple") return;
      if (!on) { sel.clear(); return; }
      const m = new Map<K, T>();
      for (const it of untrack(o.items)) m.set(keyOf(it), it);
      commit(m);
    },
    clear: () => batch(() => { anchor.set(undefined); commit(new Map()); }),
  };
  return sel;
}

// ------------------------------------------------------------------ keyboard cursor

// moved to the list-nav behavior (one source for list and grid keys); this path keeps working
export { moveCursor, type CursorInput } from "../behaviors/list-nav/index.ts";
