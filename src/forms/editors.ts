// Structured editors: ListEditor (array of strings), KeyValueEditor (object), JsonEditor, Markdown renderer and editor.
import "./editors.css";
import "../ui/field.css";
import "../ui/button.css";
import { signal, computed, effect, untrack, type Accessor } from "../core/reactive.ts";
import { svgIcon, type IconDef } from "../icons/svg.ts";
import { arrowUp } from "../icons/glyphs/arrowUp.ts";
import { arrowDown } from "../icons/glyphs/arrowDown.ts";
import { x as xIcon } from "../icons/glyphs/x.ts";
import { h } from "../dom/h.ts";
import { For } from "../dom/flow.ts";
import { t } from "../core/i18n.ts";
import { model, ctl, cx, uid, useField, syncValue, labelledBy, type ControlProps, type ClassProp } from "./util.ts";

const GLYPH: Record<string, IconDef> = { "↑": arrowUp, "↓": arrowDown, "×": xIcon };
const iconBtn = (label: string, text: string, onClick: () => void, disabled?: () => boolean) => h("button", { type: "button", class: "hm-icon-btn", "aria-label": label, title: label, onClick, disabled }, GLYPH[text] ? svgIcon(GLYPH[text] as IconDef) : text);
const splitLines = (s: unknown) => String(s ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const sameLength = (a: number[] | undefined, b: number[]) => a?.length === b.length;

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

// ------------------------------------------------------------------ JSON (moved to src/components/composite/json-editor/; these paths keep working)
export { JsonEditor, parseJson, type JsonEditorProps, type JsonParseResult, type JsonMode } from "../components/composite/json-editor/index.ts";

// ------------------------------------------------------------------ Markdown (the parser lives in the safe content core: dom/markdown.ts)
import { markdownNodes, type MarkdownOptions } from "../dom/markdown.ts";
export { markdownNodes, isSafeLink, type MarkdownOptions } from "../dom/markdown.ts";

export interface MarkdownProps extends MarkdownOptions {
  source?: string | null | undefined;
  /** A string child (when no `source`). */
  children?: unknown;
  class?: ClassProp;
}

/** Render Markdown safely. Props: source (or a string child), images (default true, https only), newTab (default true). */
export function Markdown(props: MarkdownProps): unknown {
  return h("div", { class: cx("hm-markdown", props.class) }, () => markdownNodes(props.source ?? props.children ?? "", { images: props.images, newTab: props.newTab, headingOffset: props.headingOffset }));
}

// MarkdownEditor moved to src/components/composite/markdown-editor/ (modular structure); this path keeps working.
export { MarkdownEditor, type MarkdownEditorProps, type MarkdownView, type MarkdownTool } from "../components/composite/markdown-editor/index.ts";
