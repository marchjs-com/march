// JsonEditor (hadi-march/ui, also hadi-march/forms): JSON as text or as a tree. Folder: src/components/composite/json-editor/.
//   <JsonEditor bind:value={$config} mode="tree" schema={schema} />
// Text: live parse errors with line / column, Format, Tab indents. Tree: TreeEditor (loaded the first time it is shown)
// with type badges, inline editing and its own undo history. Both views check the same schema and `validate`.
import "../../../forms/editors.css";
import "../../../ui/field.css";
import "../../../ui/button.css";
import "./json-editor.css";
import { signal, computed, effect, untrack, reactive } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { lazy } from "../../../dom/lazy.ts";
import { t, messages, dir } from "../../../core/i18n.ts";
import { cx, uid } from "../../../core/util.ts";
import { model, ctl, syncValue, type ControlProps } from "../../../forms/util.ts";
import { validateJson, pointer, type JsonSchema, type JsonError } from "../tree-editor/json-path.ts";
import tr from "./tr.ts";

messages("tr", tr);

export type JsonMode = "text" | "tree";

/** Result of parseJson(). */
export type JsonParseResult = { value: unknown; error?: undefined } | { error: string; line: number | null; column: number | null; value?: undefined };

/** Parse JSON; returns { value } or { error, line, column }. */
export function parseJson(text: string): JsonParseResult {
  try { return { value: JSON.parse(text) }; } catch (e) {
    const msg = String((e as Error).message);
    let line: number | null = null, column: number | null = null;
    const lc = /line (\d+) column (\d+)/.exec(msg);
    const pos = /position (\d+)/.exec(msg);
    if (lc) [line, column] = [+lc[1]!, +lc[2]!];
    else {
      const p = pos ? +pos[1]! : text.length;
      const before = text.slice(0, p).split("\n");
      line = before.length; column = before[before.length - 1]!.length + 1;
    }
    return { error: msg.replace(/^JSON\.parse: /, "").replace(/ in JSON at position \d+.*$/, "").replace(/\s*\(line \d+ column \d+\)$/, ""), line, column };
  }
}

export interface JsonEditorProps extends ControlProps<unknown> {
  rows?: number | undefined;
  /** Extra check of the parsed value → message or null. */
  validate?: ((value: unknown) => string | null | undefined) | undefined;
  /** JSON Schema subset (see TreeEditor): problems are listed in the text view and marked on the tree rows. */
  schema?: JsonSchema | undefined;
  /** Format indent (2). */
  indent?: number | undefined;
  /** Tab inserts two spaces (default true). */
  tabIndent?: boolean | undefined;
  /** First view (default "text"). */
  mode?: JsonMode | undefined;
  /** Views offered (default text and tree); one hides the switcher. */
  modes?: readonly JsonMode[] | undefined;
  /** Tree levels open at start (default 2). */
  expand?: number | undefined;
}

// the tree view loads with its first use (forms that only need the text view stay small)
const Tree = lazy(() => import("../tree-editor/index.ts").then((m) => ({ default: m.TreeEditor })), { placeholder: "form" });

/**
 * JSON editor with a text and a tree view: `<JsonEditor bind:value={$data} mode="tree" schema={schema} />`. Value: the
 * parsed JSON (null when empty); while the text is invalid the raw string.
 */
export function JsonEditor(props: JsonEditorProps): unknown {
  const [get, set] = model<unknown>(props, null);
  const id = uid("hm-json");
  const modes = (): readonly JsonMode[] => (props.modes?.length ? props.modes : ["text", "tree"]);
  const mode = signal<JsonMode>(untrack(() => (props.mode && modes().includes(props.mode) ? props.mode : modes()[0] ?? "text")));
  const stringify = (v: unknown): string => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v, null, props.indent ?? 2));
  const text = signal(stringify(untrack(get)));
  let lastEmitted = untrack(get);
  effect(() => {
    const v = get();
    if (v === lastEmitted) return;
    lastEmitted = v;
    untrack(() => text.set(stringify(v)));
  });
  const status = computed((): { value?: unknown; msg?: string; problems?: readonly JsonError[] } => {
    const s = text();
    if (!s.trim()) return { value: null };
    const r = parseJson(s);
    if (r.error) return { msg: t`Invalid JSON at line ${r.line}, column ${r.column}: ${r.error}` };
    const problems = validateJson(r.value, props.schema);
    if (problems.length) return { value: r.value, msg: `${pointer(problems[0]!.path) || "/"}: ${problems[0]!.message}${problems.length > 1 ? ` ${t`(+${problems.length - 1} more)`}` : ""}`, problems };
    const custom = props.validate?.(r.value);
    return custom ? { value: r.value, msg: custom } : { value: r.value };
  });
  const msgId = `${id}-msg`;
  const emit = (s: string): void => {
    text.set(s);
    const st = status.peek();
    lastEmitted = "value" in st ? st.value : s;
    set(lastEmitted);
  };
  const c = ctl(props);
  const parsed = (): boolean => "value" in status();
  const area = h("textarea", {
    ...c, class: "hm-input hm-textarea hm-mono hm-json", rows: props.rows ?? 8, spellcheck: "false", autocomplete: "off", readonly: () => !!props.readonly,
    "aria-invalid": () => (status().msg || c["aria-invalid"]() ? "true" : null),
    "aria-describedby": () => [status().msg ? msgId : null, c["aria-describedby"]()].filter(Boolean).join(" ") || null,
    onInput: (e: Event) => emit((e.target as HTMLTextAreaElement).value),
    onKeyDown: (e: KeyboardEvent) => { if (e.key === "Tab" && !e.shiftKey && props.tabIndent !== false) { e.preventDefault(); const el = e.target as HTMLTextAreaElement, a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? a; el.value = el.value.slice(0, a) + "  " + el.value.slice(b); el.selectionStart = el.selectionEnd = a + 2; emit(el.value); } },
  }) as HTMLTextAreaElement;
  syncValue(area, text);
  const format = (): void => { const st = status.peek(); if (!("value" in st)) return; emit(st.value == null ? "" : JSON.stringify(st.value, null, props.indent ?? 2)); };

  const LABEL: Record<JsonMode, () => string> = { text: () => t`Text`, tree: () => t`Tree` };
  const tabs = () => {
    const list = modes();
    if (list.length < 2) return null;
    const pick = (m: JsonMode, focus = false): void => {
      if (m === "tree" && !parsed()) return;
      mode.set(m);
      if (focus) globalThis.document?.getElementById(`${id}-tab-${m}`)?.focus();
    };
    return h("div", { role: "tablist", class: "hm-json-modes", "aria-label": () => t`JSON view` }, list.map((m) => h("button", {
      type: "button", role: "tab", id: `${id}-tab-${m}`, class: "hm-json-mode", "aria-selected": () => String(mode() === m), "aria-controls": `${id}-panel`,
      "aria-disabled": () => (m === "tree" && !parsed() ? "true" : null), title: () => (m === "tree" && !parsed() ? t`Fix the JSON to see the tree` : null),
      tabindex: () => (mode() === m ? "0" : "-1"), onClick: () => pick(m),
      onKeyDown: (e: KeyboardEvent) => {
        const i = list.indexOf(mode.peek()), fwd = untrack(dir) === "rtl" ? "ArrowLeft" : "ArrowRight", back = fwd === "ArrowRight" ? "ArrowLeft" : "ArrowRight";
        const j = e.key === fwd ? (i + 1) % list.length : e.key === back ? (i - 1 + list.length) % list.length : -1;
        if (j >= 0) { e.preventDefault(); pick(list[j]!, true); }
      },
    }, () => LABEL[m]())));
  };
  const bar = h("div", { class: "hm-json-bar" },
    h("span", { id: msgId, class: () => (status().msg ? "hm-field-error" : "hm-help"), role: "status" }, () => status().msg ?? (text().trim() ? t`Valid JSON` : "")),
    () => (props.readonly ? null : h("button", { type: "button", class: "hm-btn hm-btn-sm", disabled: () => !parsed(), onClick: format }, t`Format`)));
  // re-drawn only when the view changes (typing keeps the same textarea and caret)
  const showTree = computed(() => mode() === "tree" && parsed());
  const body = () => {
    if (!showTree()) return [area, bar];
    return untrack(() => h(Tree, {
      value: status.peek().value, onChange: (v: unknown) => { const s = JSON.stringify(v, null, props.indent ?? 2); text.set(s); lastEmitted = v; set(v); },
      // live: switching read-only or disabled reaches the tree at once
      schema: reactive(() => props.schema), readonly: reactive(() => props.readonly), disabled: reactive(() => props.disabled), expand: props.expand, label: t`JSON tree`,
      validate: props.validate ? (v: unknown) => { const m = props.validate!(v); return m ? [{ path: [], message: m }] : []; } : undefined,
    }));
  };
  return h("div", { class: () => cx("hm-json-editor", `is-${mode()}`, props.class) },
    tabs,
    h("div", { id: `${id}-panel`, class: "hm-json-panel", role: () => (modes().length > 1 ? "tabpanel" : null), "aria-labelledby": () => (modes().length > 1 ? `${id}-tab-${mode()}` : null) }, body));
}
