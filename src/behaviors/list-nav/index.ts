// hadi-march/behaviors/list-nav — keyboard movement through a list or a wrapped grid, written once:
//   moveCursor({ key, index, count, columns, page, ctrl, rtl })   the next index for a key (pure; arrows, Home / End,
//                                                                 Page Up / Down; ArrowLeft / Right swap in RTL)
//   listNav({ count, active, onPick, … })                         a keydown handler for the aria-activedescendant
//                                                                 pattern (combobox, command palette): focus stays in
//                                                                 the field, `active` is the highlighted option
// DataGrid, TreeView, Combobox / Select pickers and CommandPalette use these; for moving real focus among buttons use
// roving-focus.
import { clamp } from "../../core/util.ts";
import type { Signal } from "../../core/reactive.ts";

export interface CursorInput {
  key: string;
  index: number;
  count: number;
  /** Items per row in a wrapped grid (1 = a vertical list). */
  columns?: number | undefined;
  /** Items per PageUp / PageDown (default 10). */
  page?: number | undefined;
  /** Ctrl / ⌘ held: Home / End go to the first / last item of the whole collection. */
  ctrl?: boolean | undefined;
  /** Right-to-left: ArrowLeft / ArrowRight swap in a grid. */
  rtl?: boolean | undefined;
}

/** Next cursor index for a navigation key, or null when the key is not a navigation key. Clamped, never wraps. */
export function moveCursor({ key, index, count, columns = 1, page = 10, ctrl = false, rtl = false }: CursorInput): number | null {
  if (count <= 0) return null;
  const i = clamp(index, 0, count - 1), cols = Math.max(1, columns), fwd = rtl ? -1 : 1;
  const rowStart = i - (i % cols);
  switch (key) {
    case "ArrowDown": return Math.min(count - 1, i + cols);
    case "ArrowUp": return Math.max(0, i - cols);
    case "ArrowRight": return cols > 1 ? clamp(i + fwd, 0, count - 1) : null;
    case "ArrowLeft": return cols > 1 ? clamp(i - fwd, 0, count - 1) : null;
    case "Home": return ctrl || cols === 1 ? 0 : rowStart;
    case "End": return ctrl || cols === 1 ? count - 1 : Math.min(count - 1, rowStart + cols - 1);
    case "PageDown": return Math.min(count - 1, i + page * cols);
    case "PageUp": return Math.max(0, i - page * cols);
    default: return null;
  }
}

/** Options of listNav(). */
export interface ListNavOptions {
  /** Number of options. */
  count: () => number;
  /** Highlighted index (-1 = none). */
  active: Signal<number>;
  /** Enter on the highlighted option. */
  onPick: (i: number) => void;
  /** ArrowUp / ArrowDown while closed (a combobox opens). */
  onOpen?: (() => void) | undefined;
  isOpen?: (() => boolean) | undefined;
  /** ArrowDown on the last option goes to the first and back (default true). */
  loop?: boolean | undefined;
  /** Options per Page Up / Page Down (default 10). */
  page?: number | undefined;
  /** Called with the new index after a move (scroll it into view, announce it…). */
  onMove?: ((i: number) => void) | undefined;
}

/**
 * Keyboard navigation over options shown by a field (aria-activedescendant pattern). Returns a keydown handler that
 * returns true when it handled the key. Home / End need Ctrl / ⌘ (without it they move the caret in the field).
 */
export function listNav({ count, active, onPick, onOpen, isOpen = () => true, loop = true, page = 10, onMove }: ListNavOptions): (e: KeyboardEvent) => boolean {
  return (e) => {
    const n = count(), k = e.key;
    if ((k === "ArrowDown" || k === "ArrowUp") && !isOpen()) { e.preventDefault(); onOpen?.(); return true; }
    if (!isOpen()) return false;
    const i = active.peek();
    if (k === "Enter") {
      if (i < 0 || i >= n) return false;
      e.preventDefault(); onPick(i); return true;
    }
    if ((k === "Home" || k === "End") && !(e.ctrlKey || e.metaKey)) return false;
    let next = moveCursor({ key: k, index: i < 0 ? (k === "ArrowUp" ? n : -1) : i, count: n, page, ctrl: true });
    if (next == null) return false;
    if (loop && k === "ArrowDown" && i === n - 1) next = 0;
    else if (loop && k === "ArrowUp" && i === 0) next = n - 1;
    else if (i < 0 && k === "ArrowDown") next = 0;
    else if (i < 0 && k === "ArrowUp") next = n - 1;
    e.preventDefault();
    active.set(n ? next : -1);
    if (n) onMove?.(next);
    return true;
  };
}
