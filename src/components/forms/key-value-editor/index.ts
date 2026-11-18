// KeyValueEditor: edit an object of key → value rows (order kept, duplicate keys flagged).
import "./key-value-editor.css";
import "../../../ui/field.css";
import { signal, effect, untrack, type Accessor } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { For } from "../../../dom/for.ts";
import { t } from "../../../core/i18n.ts";
import { model, cx, live, useField, labelledBy, type ControlProps } from "../../../forms/util.ts";
import { rowList, rowToolsProps, outsideField } from "../../../forms/rows.ts";
import { Button } from "../../actions/button/index.ts";
import { RowTools } from "../row-tools/index.ts";
import { TextInput } from "../text-input/index.ts";
import type { IconProp } from "../../../icons/types.ts";

export interface KeyValueEditorProps extends ControlProps<Record<string, string | number>> {
  /** Placeholder of the key fields (default "Key"). @tr Anahtar alanlarının yer tutucusu (varsayılan "Key"). */
  keyPlaceholder?: string | undefined;
  /** Placeholder of the value fields (default "Value"). @tr Değer alanlarının yer tutucusu (varsayılan "Value"). */
  valuePlaceholder?: string | undefined;
  /** Numeric-looking values become numbers. @tr Sayıya benzeyen değerler sayı olur. */
  numbers?: boolean | undefined;
  /** Texts: `key` / `value` (accessible names and default placeholders), `remove`, `add` ("Add row"), `duplicate` ("Duplicate key"). @tr Metinler: `key` / `value` (erişilebilir adlar ve varsayılan yer tutucular), `remove`, `add` ("Add row"), `duplicate` ("Duplicate key"). */
  labels?: { key?: string | undefined; value?: string | undefined; remove?: string | undefined; add?: unknown; duplicate?: unknown } | undefined;
  /** The remove button of a row: `false` removes it. @tr Satırın kaldırma düğmesi: `false` kaldırır. */
  removable?: boolean | undefined;
  /** The "Add row" button: `false` removes it. @tr "Add row" düğmesi: `false` kaldırır. */
  addable?: boolean | undefined;
  /** Content of the remove button instead of the "×" icon (a node, text or `() => node`). @tr Kaldırma düğmesinde "×" ikonu yerine içerik (düğüm, metin ya da `() => node`). */
  removeIcon?: IconProp;
}

/**
 * Edit an object of string → string (or number with `numbers`). Rows keep their order; empty keys are skipped; duplicate
 * keys are flagged. Props: keyPlaceholder, valuePlaceholder, numbers (numeric-looking values become numbers).
 */
export function KeyValueEditor(props: KeyValueEditorProps): unknown {
  const [get, set] = model<Record<string, string | number>>(props, {});
  type Row = [string, string];
  const rows = signal<Row[]>(Object.entries(untrack(get) ?? {}).map(([k, v]): Row => [k, v == null ? "" : String(v)]), { equals: false });
  let last = JSON.stringify(untrack(get) ?? {});
  const toObj = (rs: Row[]) => {
    const o: Record<string, string | number> = {};
    for (const [k, v] of rs) { const key = k.trim(); if (!key || key in o) continue; o[key] = props.numbers && v.trim() !== "" && !isNaN(Number(v)) ? Number(v) : v; }
    return o;
  };
  const emit = (rs: Row[]) => { rows.set(rs); const o = toObj(rs); last = JSON.stringify(o); set(o); };
  effect(() => { const v = get() ?? {}; const s = JSON.stringify(v); if (s !== last) { last = s; untrack(() => rows.set(Object.entries(v).map(([k, x]): Row => [k, x == null ? "" : String(x)]))); } });
  const list = rowList(rows, emit, props);
  const { idx, ro } = list;
  const dup = (i: number) => { const rs = rows(); const k = rs[i]?.[0].trim(); return !!k && rs.findIndex((r) => r[0].trim() === k) !== i; };
  const field = useField();
  const edit = (i: number, col: 0 | 1, v: string) => { const rs = rows.peek().map((r): Row => [...r]); rs[i]![col] = v; emit(rs); };
  const cell = (i: Accessor<number>, col: 0 | 1, name: () => string, placeholder: () => string) => outsideField(() => h(TextInput, {
    // the first key is the field's control (the <label for> of the enclosing Field points at it)
    id: col === 0 && i.peek() === 0 ? props.id ?? field?.id : undefined, "aria-label": live(name), placeholder: live(placeholder), readonly: live(ro),
    invalid: live(() => col === 0 && dup(i())), value: live(() => rows()[i()]?.[col] ?? ""), setValue: (v: string) => edit(i.peek(), col, v), onBlur: props.onBlur,
  }));
  return h("div", { class: () => cx("m-kv-editor", props.class), role: "group", "aria-labelledby": labelledBy(props) },
    h(For, { each: idx, children: (i: Accessor<number>) => h("div", { class: "m-kv-row" },
      cell(i, 0, () => props.labels?.key ?? t`Key`, () => props.keyPlaceholder ?? props.labels?.key ?? t`Key`),
      cell(i, 1, () => props.labels?.value ?? t`Value`, () => props.valuePlaceholder ?? props.labels?.value ?? t`Value`),
      () => (ro() || props.removable === false ? null : h(RowTools, rowToolsProps(list, i, { sortable: false, labels: { remove: props.labels?.remove }, icons: { remove: props.removeIcon } }))),
      () => (dup(i()) ? h("span", { class: "m-field-error", role: "alert" }, props.labels?.duplicate ?? t`Duplicate key`) : null)) }),
    () => (ro() || props.addable === false ? null : h(Button, { class: "m-kv-add", onClick: () => { rows.set([...rows.peek(), ["", ""]]); } }, props.labels?.add ?? t`Add row`)));
}
