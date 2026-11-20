// ListEditor: edit an array of strings (add, remove, reorder by the buttons or by dragging a row's grip; pasting lines
// adds one item per line).
import "./list-editor.css";
import "../../../ui/field.css";
import { untrack, onCleanup, getOwner, signal, batch, type Accessor } from "../../../core/reactive.ts";
import { pointerDrag } from "../../../behaviors/drag/index.ts";
import { frame } from "../../../motion/env.ts";
import { h } from "../../../dom/h.ts";
import { For } from "../../../dom/for.ts";
import { t } from "../../../core/i18n.ts";
import { model, cx, live, labelledBy, useField, type ControlProps } from "../../../forms/util.ts";
import { splitLines, rowList, rowToolsProps, outsideField } from "../../../forms/rows.ts";
import { Button } from "../../actions/button/index.ts";
import { RowTools } from "../row-tools/index.ts";
import { TextInput } from "../text-input/index.ts";

export interface ListEditorProps extends ControlProps<string[]> {
  /** Placeholder of the add field (default "Add an item"). @tr Ekleme alanının yer tutucusu (varsayılan "Add an item"). */
  placeholder?: string | undefined;
  /** Most items. @tr En fazla öğe sayısı. */
  max?: number | undefined;
  /** Skip duplicates (default true). @tr Yinelenenleri atlar (varsayılan true). */
  unique?: boolean | undefined;
  /** Text of the add button (default "Add"). @tr Ekle düğmesinin metni (varsayılan "Add"). */
  addLabel?: string | undefined;
  /** Accessible names: `item` (`(position) => text`, default "Item 2"), `moveUp`, `moveDown`, `remove`. @tr Erişilebilir adlar: `item` (`(position) => text`, varsayılan "Item 2"), `moveUp`, `moveDown`, `remove`. */
  labels?: { item?: ((position: number) => string) | undefined; moveUp?: string | undefined; moveDown?: string | undefined; remove?: string | undefined } | undefined;
  /** Reordering: the move up / down buttons and the drag grip of each row; `false` removes them. @tr Sıralama: yukarı / aşağı taşıma düğmeleri ve her satırın sürükleme tutamağı; `false` kaldırır. */
  sortable?: boolean | undefined;
  /** The remove button of a row: `false` removes it (clearing a row's text still removes it). @tr Satırın kaldırma düğmesi: `false` kaldırır (satırın metnini silmek yine kaldırır). */
  removable?: boolean | undefined;
  /** The "add an item" line under the list: `false` removes it. @tr Listenin altındaki "öğe ekle" satırı: `false` kaldırır. */
  addable?: boolean | undefined;
  /** Content of the row buttons instead of the ↑ ↓ × icons (each a node, text or `() => node`). @tr Satır düğmelerinde ↑ ↓ × ikonları yerine içerik (her biri düğüm, metin ya da `() => node`). */
  icons?: { up?: unknown; down?: unknown; remove?: unknown } | undefined;
}

/**
 * Edit an array of strings: add, remove, move up/down (or drag a row by its grip); pasting several lines adds one item per line.
 * Props: placeholder, max (items), unique (default true), addLabel.
 */
export function ListEditor(props: ListEditorProps): unknown {
  const [get, set] = model<string[]>(props, []);
  const list = () => get() ?? [];
  const rows = rowList(list, set, props);
  const { idx, ro, full } = rows;
  // drag to reorder: while a row is dragged the rows show the order it would make (`shown`); the value is set once, on drop
  const dragFrom = signal<number | null>(null), dragTo = signal(0);
  const shown = (): readonly string[] => {
    const l = list(), f = dragFrom();
    if (f == null) return l;
    const c = [...l]; const [x] = c.splice(f, 1); c.splice(dragTo(), 0, x!); return c;
  };
  const canDrag = (): boolean => !ro() && props.sortable !== false && list().length > 1;
  const grab = (e: PointerEvent, i: Accessor<number>): void => {
    if (e.button !== 0 || !canDrag()) return;
    const ol = (e.currentTarget as HTMLElement).closest("ol");
    if (!ol) return;
    e.preventDefault();
    const from = i.peek();
    pointerDrag(e, {
      threshold: 2,
      onStart: () => batch(() => { dragFrom.set(from); dragTo.set(from); }),
      onMove: (p) => {
        // the new place: how many of the other rows have their middle above the pointer
        const at = untrack(dragTo);
        let to = 0;
        Array.from(ol.children).forEach((row, k) => { if (k !== at) { const b = row.getBoundingClientRect(); if (p.clientY > b.top + b.height / 2) to++; } });
        if (to !== at) dragTo.set(to);
      },
      onEnd: (_p, cancelled) => {
        const f = untrack(dragFrom), next = untrack(shown);
        batch(() => { dragFrom.set(null); if (!cancelled && f != null && f !== untrack(dragTo)) set([...next]); });
      },
    });
  };
  const add = (items: string[]) => {
    let cur = [...untrack(list)];
    for (const s of items) if (props.unique === false || !cur.includes(s)) cur.push(s);
    if (props.max != null) cur = cur.slice(0, props.max);
    set(cur);
  };
  // the draft line is the field's control (id, aria-invalid, aria-describedby come from the enclosing <Field>)
  let draft!: HTMLInputElement;
  const inField = !!useField();
  const offs: (() => void)[] = [];
  if (getOwner()) onCleanup(() => { for (const f of offs) f(); });
  const draftInput = h(TextInput, {
    // inside a Field its label names the draft line; alone it is named by aria-label, else by what it does
    id: props.id, "aria-label": live(() => props["aria-label"] ?? (inField ? null : props.placeholder ?? t`Add an item`)), placeholder: live(() => props.placeholder ?? t`Add an item`), disabled: live(() => ro() || full()), invalid: live(() => props.invalid), describedby: live(() => props.describedby),
    onBlur: props.onBlur, ref: (el: HTMLInputElement) => {
      draft = el;
      // in a Field drawn as a group (its label is not a <label for>) the line has no name of its own: what it does names it
      if (inField) offs.push(frame(() => { if (!el.labels?.length && !el.hasAttribute("aria-label")) el.setAttribute("aria-label", props.placeholder ?? t`Add an item`); }));
    },
    onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); const v = draft.value.trim(); if (v) { add([v]); draft.value = ""; } } },
    onPaste: (e: ClipboardEvent) => { const lines = splitLines(e.clipboardData?.getData("text")); if (lines.length > 1) { e.preventDefault(); add(lines); draft.value = ""; } },
  });
  return h("div", { class: () => cx("m-list-editor", props.class), role: "group", "aria-labelledby": labelledBy(props) },
    h("ol", { class: () => cx("m-list-items", dragFrom() != null && "is-sorting") }, h(For, { each: idx, children: (i: Accessor<number>) => h("li", { class: () => cx("m-list-row", dragFrom() != null && i() === dragTo() && "is-dragging") },
      // the grip: pointer only (the ↑ ↓ buttons are the keyboard's way), hidden from screen readers
      () => (canDrag() ? h("span", { class: "m-list-grip", "aria-hidden": "true", onPointerdown: (e: PointerEvent) => grab(e, i) }) : null),
      outsideField(() => h(TextInput, {
        "aria-label": live(() => props.labels?.item?.(i() + 1) ?? t`Item ${i() + 1}`), readonly: live(ro),
        value: live(() => shown()[i()] ?? ""), setValue: (v: string) => { const cur = [...untrack(list)]; cur[i.peek()] = v; set(cur); },
        onBlur: () => { if (!String(untrack(list)[i.peek()] ?? "").trim()) rows.remove(i.peek()); },
        onPaste: (e: ClipboardEvent) => {
          const lines = splitLines(e.clipboardData?.getData("text"));
          if (lines.length > 1) { e.preventDefault(); const cur = [...untrack(list)]; cur.splice(i.peek(), 1, ...lines); set(cur); }
        },
      })),
      () => (ro() || (props.sortable === false && props.removable === false) ? null : h(RowTools, rowToolsProps(rows, i, {
        sortable: props.sortable, removable: props.removable,
        labels: { up: props.labels?.moveUp, down: props.labels?.moveDown, remove: props.labels?.remove },
        icons: props.icons,
      })))) })),
    () => (ro() || props.addable === false ? null : h("div", { class: "m-list-add" }, draftInput,
      h(Button, { disabled: full, onClick: () => { const lines = splitLines(draft.value); if (lines.length) { add(lines); draft.value = ""; } draft.focus(); } }, () => props.addLabel ?? t`Add`))));
}
