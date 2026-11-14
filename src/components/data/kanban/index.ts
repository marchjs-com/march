// Kanban (hadi-march/ui). Folder: src/components/data/kanban/. Cards move with the drag behavior (mouse and pen at
// once, touch after a long press so the board still scrolls) or with Alt+← / Alt+→.
import "./kanban.css";
import { signal, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { setStyle } from "../../../core/util.ts";
import { owned } from "../../../ui/observe.ts";
import { draggable } from "../../../behaviors/drag/index.ts";
import { dragGhost, type DragGhost } from "../../../behaviors/drag/ghost.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { PanelHeader } from "../../layout/panel-header/index.ts";
import { StatusDot, type StatusDotTone } from "../../feedback/status-dot/index.ts";
import { Badge } from "../badge/index.ts";

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
  const cards = new WeakMap<Element, { item: T; from: string }>();
  let card: HTMLElement | null = null, ghost: DragGhost | null = null;
  const colAt = (x: number, y: number): string | null => {
    const col = root.ownerDocument.elementFromPoint?.(x, y)?.closest<HTMLElement>(".m-kanban-col");
    return col && root.contains(col) ? col.getAttribute("data-col") : null;
  };
  const root = h("div", { class: () => cx("m-kanban", props.animate === false && "is-still", val(props.class)) }, () => {
    const cols = val(props.columns);
    return untrack(() => cols.map((col, ci) => h("section", {
      class: () => cx("m-kanban-col", over() === col.id && "is-over"), "data-col": col.id, "aria-label": typeof col.title === "string" ? col.title : null,
    },
    // column head: one PanelHeader (dot · title · count)
    h(PanelHeader, {
      class: "m-kanban-head", size: "sm", title: col.title, titleAs: "span", partClass: { title: "m-kanban-title" },
      lead: props.dot === false ? undefined : typeof props.dot === "function" ? h("span", { class: "m-kanban-dot-own", "aria-hidden": "true" }, props.dot(col))
        : h(StatusDot, { class: cx("m-kanban-dot", col.tone && `m-kanban-dot-${col.tone}`), tone: (col.tone as StatusDotTone | undefined) ?? "neutral", color: col.color }),
      meta: props.count === false ? undefined : h(Badge, { class: cx("m-kanban-count", typeof props.count === "function" && "is-own") }, typeof props.count === "function" ? props.count(col) : String(col.items.length)),
    }),
    h("div", { class: "m-kanban-list" }, col.items.map((it) => h("article", {
      class: "m-kanban-card", tabindex: "0", "data-key": props.itemKey(it), ref: (el: Element) => { cards.set(el, { item: it, from: col.id }); },
      onKeydown: (e: KeyboardEvent) => {
        if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
        const to = cols[ci + (e.key === "ArrowRight" ? 1 : -1)];
        if (to) { e.preventDefault(); props.onMove?.(it, col.id, to.id); }
      },
    }, props.card(it)))))));
  }) as HTMLElement;
  // one drag session per press on a card: a copy of the card follows the pointer, the column under it is marked
  owned(draggable(root, {
    handle: ".m-kanban-card", hold: 250, scroll: root,
    onPress: (e) => { card = (e.target as Element).closest<HTMLElement>(".m-kanban-card"); },
    onStart: (p) => {
      if (!card) return;
      const box = card.getBoundingClientRect(), copy = card.cloneNode(true) as HTMLElement;
      copy.classList.add("m-kanban-ghost");
      copy.removeAttribute("tabindex");
      setStyle(copy, { width: `${box.width}px` });
      ghost = dragGhost(copy, { offset: { x: box.left - p.clientX, y: box.top - p.clientY }, motion: props.animate });
      card.classList.add("is-dragging");
    },
    onMove: (p) => { ghost?.move(p.clientX, p.clientY); over.set(colAt(p.clientX, p.clientY)); },
    onEnd: (p, cancelled) => {
      const moved = card ? cards.get(card) : undefined, to = cancelled ? null : colAt(p.clientX, p.clientY);
      card?.classList.remove("is-dragging");
      ghost?.close(); ghost = null; card = null;
      over.set(null);
      if (moved && to && to !== moved.from) props.onMove?.(moved.item, moved.from, to);
    },
  }));
  return root;
}
