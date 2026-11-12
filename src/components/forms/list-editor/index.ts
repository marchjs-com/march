// ListEditor: edit an array of strings (add, remove, reorder; pasting lines adds one item per line).
import "./list-editor.css";
import "../../../ui/field.css";
import "../../../ui/button.css";
import { computed, untrack, type Accessor } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { For } from "../../../dom/for.ts";
import { t } from "../../../core/i18n.ts";
import { model, ctl, cx, useField, syncValue, labelledBy, type ControlProps } from "../../../forms/util.ts";
import { iconBtn, splitLines, sameLength } from "../../../forms/rows.ts";

export interface ListEditorProps extends ControlProps<string[]> {
  placeholder?: string | undefined;
  /** Most items. */
  max?: number | undefined;
  /** Skip duplicates (default true). */
  unique?: boolean | undefined;
  addLabel?: string | undefined;
}

/**
 * Edit an array of strings: add, remove, move up/down; pasting several lines adds one item per line.
 * Props: placeholder, max (items), unique (default true), addLabel.
 */
export function ListEditor(props: ListEditorProps): unknown {
  const [get, set] = model<string[]>(props, []);
  const list = () => get() ?? [];
  const idx = computed(() => list().map((_, i) => i), { equals: sameLength });
  const field = useField();
  const c = ctl(props);
  const ro = () => !!(props.disabled || props.readonly);
  const full = () => props.max != null && list().length >= props.max;
  const add = (items: string[]) => {
    let cur = [...untrack(list)];
    for (const s of items) if (props.unique === false || !cur.includes(s)) cur.push(s);
    if (props.max != null) cur = cur.slice(0, props.max);
    set(cur);
  };
  const move = (i: number, d: number) => { const cur = [...untrack(list)]; const j = i + d; if (j < 0 || j >= cur.length) return; [cur[i], cur[j]] = [cur[j]!, cur[i]!]; set(cur); };
  const draft = h("input", {
    type: "text", class: "hm-input", id: props.id ?? field?.id, placeholder: () => props.placeholder ?? t`Add an item`, disabled: () => ro() || full(),
    "aria-invalid": c["aria-invalid"], "aria-describedby": c["aria-describedby"], onBlur: props.onBlur,
    onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); const v = draft.value.trim(); if (v) { add([v]); draft.value = ""; } } },
    onPaste: (e: ClipboardEvent) => { const text = e.clipboardData?.getData("text") ?? ""; const lines = splitLines(text); if (lines.length > 1) { e.preventDefault(); add(lines); draft.value = ""; } },
  }) as HTMLInputElement;
  return h("div", { class: cx("hm-list-editor", props.class), role: "group", "aria-labelledby": labelledBy(props) },
    h("ol", { class: "hm-list-items" }, h(For, { each: idx, children: (i: Accessor<number>) => {
      const row = h("input", {
        type: "text", class: "hm-input", "aria-label": () => t`Item ${i() + 1}`, readonly: ro,
        onInput: (e: Event) => { const cur = [...untrack(list)]; cur[i.peek()] = (e.target as HTMLInputElement).value; set(cur); },
        onBlur: () => { const cur = untrack(list); if (!String(cur[i.peek()] ?? "").trim()) set(cur.filter((_, j) => j !== i.peek())); },
        onPaste: (e: ClipboardEvent) => {
          const lines = splitLines(e.clipboardData?.getData("text"));
          if (lines.length > 1) { e.preventDefault(); const cur = [...untrack(list)]; cur.splice(i.peek(), 1, ...lines); set(cur); }
        },
      }) as HTMLInputElement;
      syncValue(row, () => list()[i()] ?? "");
      return h("li", { class: "hm-list-row" }, row,
        () => (ro() ? null : [
          iconBtn(t`Move up`, "↑", () => move(i.peek(), -1), () => i() === 0),
          iconBtn(t`Move down`, "↓", () => move(i.peek(), 1), () => i() === list().length - 1),
          iconBtn(t`Remove`, "×", () => set(untrack(list).filter((_, j) => j !== i.peek()))),
        ]));
    } })),
    () => (ro() ? null : h("div", { class: "hm-list-add" }, draft,
      h("button", { type: "button", class: "hm-btn", disabled: () => full(), onClick: () => { const lines = splitLines(draft.value); if (lines.length) { add(lines); draft.value = ""; } draft.focus(); } }, () => props.addLabel ?? t`Add`))));
}
