// ListEditor: edit an array of strings (add, remove, reorder; pasting lines adds one item per line).
import "./list-editor.css";
import "../../../ui/field.css";
import { untrack, type Accessor } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { For } from "../../../dom/for.ts";
import { t } from "../../../core/i18n.ts";
import { model, cx, live, labelledBy, type ControlProps } from "../../../forms/util.ts";
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
  /** The move up / down buttons: `false` removes them. @tr Yukarı / aşağı taşıma düğmeleri: `false` kaldırır. */
  sortable?: boolean | undefined;
  /** The remove button of a row: `false` removes it (clearing a row's text still removes it). @tr Satırın kaldırma düğmesi: `false` kaldırır (satırın metnini silmek yine kaldırır). */
  removable?: boolean | undefined;
  /** The "add an item" line under the list: `false` removes it. @tr Listenin altındaki "öğe ekle" satırı: `false` kaldırır. */
  addable?: boolean | undefined;
  /** Content of the row buttons instead of the ↑ ↓ × icons (each a node, text or `() => node`). @tr Satır düğmelerinde ↑ ↓ × ikonları yerine içerik (her biri düğüm, metin ya da `() => node`). */
  icons?: { up?: unknown; down?: unknown; remove?: unknown } | undefined;
}

/**
 * Edit an array of strings: add, remove, move up/down; pasting several lines adds one item per line.
 * Props: placeholder, max (items), unique (default true), addLabel.
 */
export function ListEditor(props: ListEditorProps): unknown {
  const [get, set] = model<string[]>(props, []);
  const list = () => get() ?? [];
  const rows = rowList(list, set, props);
  const { idx, ro, full } = rows;
  const add = (items: string[]) => {
    let cur = [...untrack(list)];
    for (const s of items) if (props.unique === false || !cur.includes(s)) cur.push(s);
    if (props.max != null) cur = cur.slice(0, props.max);
    set(cur);
  };
  // the draft line is the field's control (id, aria-invalid, aria-describedby come from the enclosing <Field>)
  let draft!: HTMLInputElement;
  const draftInput = h(TextInput, {
    id: props.id, placeholder: live(() => props.placeholder ?? t`Add an item`), disabled: live(() => ro() || full()), invalid: live(() => props.invalid), describedby: live(() => props.describedby),
    onBlur: props.onBlur, ref: (el: HTMLInputElement) => { draft = el; },
    onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); const v = draft.value.trim(); if (v) { add([v]); draft.value = ""; } } },
    onPaste: (e: ClipboardEvent) => { const lines = splitLines(e.clipboardData?.getData("text")); if (lines.length > 1) { e.preventDefault(); add(lines); draft.value = ""; } },
  });
  return h("div", { class: () => cx("m-list-editor", props.class), role: "group", "aria-labelledby": labelledBy(props) },
    h("ol", { class: "m-list-items" }, h(For, { each: idx, children: (i: Accessor<number>) => h("li", { class: "m-list-row" },
      outsideField(() => h(TextInput, {
        "aria-label": live(() => props.labels?.item?.(i() + 1) ?? t`Item ${i() + 1}`), readonly: live(ro),
        value: live(() => list()[i()] ?? ""), setValue: (v: string) => { const cur = [...untrack(list)]; cur[i.peek()] = v; set(cur); },
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
