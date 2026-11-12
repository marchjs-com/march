// hadi-march/behaviors/drag — the one source of pointer dragging (resize handles, column and tab reordering, tree and
// calendar items, canvas nodes, sheets). Two levels:
//   pointerDrag(downEvent, { onStart, onMove, onEnd, onClick, scroll, threshold })   one session from a pointerdown
//   draggable(el, { handle, onMove, … })  /  <div use:draggable={[draggable, opts]}>   binds an element
// Threshold (a click stays a click), pointer capture, Escape cancels, edge auto-scroll on the motion clock (global pause
// and speed apply), deltas that follow the container's scroll, and `di` along the writing direction (RTL mirrored).
import { pointerDrag, type PointerDragOptions, type DragPoint } from "./drag.ts";

export { pointerDrag };
export type { PointerDragOptions, DragPoint };

/** Options of draggable(): a pointerDrag session per press, plus which presses start one. */
export interface DraggableOptions extends PointerDragOptions {
  /** CSS selector of the part that starts a drag (default: the whole element). */
  handle?: string | undefined;
  /** Selector of parts that never start a drag (default: form fields, links and buttons inside it). */
  ignore?: string | undefined;
  /** Mouse button (default 0, the primary); touch and pen always count. */
  button?: number | undefined;
  /** Off while it returns true. */
  disabled?: (() => boolean) | undefined;
  /** Called with the pointerdown before the session; return false to skip this press. */
  onPress?: ((e: PointerEvent) => boolean | void) | undefined;
}

const IGNORE = "input, textarea, select, button, a[href], [contenteditable=''], [contenteditable='true']";

/**
 * Make an element draggable: every press on it (or on `handle`) starts a pointerDrag session. Returns the cleanup.
 * Works as an action: `<div use:draggable={[draggable, { handle: ".grip", onMove: (p) => … }]}>`.
 */
export function draggable(el: Element, o: DraggableOptions = {}): () => void {
  const down = (e: Event): void => {
    const pe = e as PointerEvent;
    if (o.disabled?.()) return;
    if (pe.pointerType === "mouse" && pe.button !== (o.button ?? 0)) return;
    const t = pe.target as Element | null;
    if (o.handle && !t?.closest?.(o.handle)) return;
    const skip = t?.closest?.(o.ignore ?? IGNORE);
    if (skip && skip !== el && el.contains(skip)) return;
    if (o.onPress?.(pe) === false) return;
    pointerDrag(pe, o);
  };
  el.addEventListener("pointerdown", down);
  return () => el.removeEventListener("pointerdown", down);
}
