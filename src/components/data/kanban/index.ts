// Kanban (hadi-march/ui). Folder: src/components/data/kanban/.
import "./kanban.css";
import { signal, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

export interface KanbanColumn<T> {
  id: string;
  title: unknown;
  /** Dot colour family: primary, info, success, warn. */
  tone?: string | undefined;
  /** Dot colour as a theme token ("brand-orange", "cat-3" …); wins over `tone`. */
  color?: ColorToken | undefined;
  items: readonly T[];
}
export interface KanbanProps<T> {
  columns: MaybeFn<readonly KanbanColumn<T>[]>;
  /** Card content for an item. */
  card: (item: T) => unknown;
  itemKey: (item: T) => string;
  /** Called when a card is dropped on another column (drag and drop; keyboard: Alt+← / Alt+→ on a focused card). */
  onMove?: (item: T, from: string, to: string) => void;
  /** The dot before a column title: true (default), false, or `(column) => node`. */
  dot?: boolean | ((column: KanbanColumn<T>) => unknown) | undefined;
  /** The card count of a column: true (default), false, or `(column) => node`. */
  count?: boolean | ((column: KanbanColumn<T>) => unknown) | undefined;
  /** Cards scale in when they appear (default true). */
  animate?: boolean | undefined;
  class?: ClassProp;
}
/** Board with columns and draggable cards. */
export function Kanban<T>(props: KanbanProps<T>): Element {
  const over = signal<string | null>(null);
  let dragging: { item: T; from: string } | null = null;
  return h("div", { class: () => cx("hm-kanban", props.animate === false && "is-still", val(props.class)) }, () => {
    const cols = val(props.columns);
    return untrack(() => cols.map((col, ci) => h("section", {
      class: () => cx("hm-kanban-col", over() === col.id && "is-over"), "aria-label": typeof col.title === "string" ? col.title : null,
      onDragover: (e: DragEvent) => { if (dragging) { e.preventDefault(); over.set(col.id); } },
      onDragleave: () => over.set(null),
      onDrop: (e: DragEvent) => { e.preventDefault(); over.set(null); if (dragging && dragging.from !== col.id) props.onMove?.(dragging.item, dragging.from, col.id); dragging = null; },
    },
    h("header", { class: "hm-kanban-head" },
      props.dot === false ? null : typeof props.dot === "function" ? h("span", { class: "hm-kanban-dot-own", "aria-hidden": "true" }, props.dot(col))
        : h("span", { class: cx("hm-kanban-dot", col.tone && `hm-kanban-dot-${col.tone}`), "data-hm-color": colorAttr(col.color) }),
      h("span", { class: "hm-kanban-title" }, col.title),
      props.count === false ? null : h("span", { class: cx("hm-kanban-count", typeof props.count === "function" && "is-own") }, typeof props.count === "function" ? props.count(col) : String(col.items.length))),
    h("div", { class: "hm-kanban-list" }, col.items.map((it) => h("article", {
      class: "hm-kanban-card", draggable: "true", tabindex: "0", "data-key": props.itemKey(it),
      onDragstart: (e: DragEvent) => { dragging = { item: it, from: col.id }; e.dataTransfer?.setData("text/plain", props.itemKey(it)); (e.currentTarget as HTMLElement).classList.add("is-dragging"); },
      onDragend: (e: DragEvent) => { (e.currentTarget as HTMLElement).classList.remove("is-dragging"); over.set(null); },
      onKeydown: (e: KeyboardEvent) => {
        if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
        const to = cols[ci + (e.key === "ArrowRight" ? 1 : -1)];
        if (to) { e.preventDefault(); props.onMove?.(it, col.id, to.id); }
      },
    }, props.card(it)))))));
  });
}
