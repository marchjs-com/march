// KeyValueEditor: edit an object of key → value rows (order kept, duplicate keys flagged).
import "./key-value-editor.css";
import "../../../ui/field.css";
import "../../../ui/button.css";
import { signal, computed, effect, untrack, type Accessor } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { For } from "../../../dom/for.ts";
import { t } from "../../../core/i18n.ts";
import { model, cx, useField, syncValue, labelledBy, type ControlProps } from "../../../forms/util.ts";
import { iconBtn, sameLength } from "../../../forms/rows.ts";

export interface KeyValueEditorProps extends ControlProps<Record<string, string | number>> {
  keyPlaceholder?: string | undefined;
  valuePlaceholder?: string | undefined;
  /** Numeric-looking values become numbers. */
  numbers?: boolean | undefined;
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
  const idx = computed(() => rows().map((_, i) => i), { equals: sameLength });
  const dup = (i: number) => { const rs = rows(); const k = rs[i]?.[0].trim(); return !!k && rs.findIndex((r) => r[0].trim() === k) !== i; };
  const ro = () => !!(props.disabled || props.readonly);
  const field = useField();
  const edit = (i: number, col: 0 | 1, v: string) => { const rs = rows.peek().map((r): Row => [...r]); rs[i]![col] = v; emit(rs); };
  return h("div", { class: cx("hm-kv-editor", props.class), role: "group", "aria-labelledby": labelledBy(props) },
    h(For, { each: idx, children: (i: Accessor<number>) => {
      const k = h("input", { type: "text", class: "hm-input", id: () => (i() === 0 ? props.id ?? field?.id : null), "aria-label": t`Key`, placeholder: () => props.keyPlaceholder ?? t`Key`, readonly: ro, "aria-invalid": () => (dup(i()) ? "true" : null), onInput: (e: Event) => edit(i.peek(), 0, (e.target as HTMLInputElement).value), onBlur: props.onBlur }) as HTMLInputElement;
      const v = h("input", { type: "text", class: "hm-input", "aria-label": t`Value`, placeholder: () => props.valuePlaceholder ?? t`Value`, readonly: ro, onInput: (e: Event) => edit(i.peek(), 1, (e.target as HTMLInputElement).value), onBlur: props.onBlur }) as HTMLInputElement;
      syncValue(k, () => rows()[i()]?.[0]);
      syncValue(v, () => rows()[i()]?.[1]);
      return h("div", { class: "hm-kv-row" }, k, v,
        () => (ro() ? null : iconBtn(t`Remove`, "×", () => emit(rows.peek().filter((_, j) => j !== i.peek())))),
        () => (dup(i()) ? h("span", { class: "hm-field-error", role: "alert" }, t`Duplicate key`) : null));
    } }),
    () => (ro() ? null : h("button", { type: "button", class: "hm-btn hm-kv-add", onClick: () => { rows.set([...rows.peek(), ["", ""]]); } }, t`Add row`)));
}
