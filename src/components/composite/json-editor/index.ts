// JsonEditor (march/ui, also march/forms): JSON as text or as a tree. Folder: src/components/composite/json-editor/.
//   <JsonEditor bind:value={$config} mode="tree" schema={schema} />
// Text: live parse errors with line / column, Format, Tab indents. Tree: TreeEditor (loaded the first time it is shown)
// with type badges, inline editing and its own undo history. Both views check the same schema and `validate`.
// Built from Textarea (text view), the pill strip of Tabs (TabList: the view switcher), Button and TreeEditor.
import "../../../forms/editors.css";
import "../../../ui/field.css";
import "./json-editor.css";
import { signal, computed, effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { lazy } from "../../../dom/lazy.ts";
import { t, messages } from "../../../core/i18n.ts";
import { cx, uid } from "../../../core/util.ts";
import { model, ctl, live, type ControlProps } from "../../../forms/util.ts";
import { Textarea } from "../../forms/textarea/index.ts";
import { Button } from "../../../ui/button.ts";
import { TabList, type TabSpec } from "../../../ui/tabs.ts";
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
  /** Height of the text view in lines (default 8). @tr Metin görünümünün satır cinsinden yüksekliği (varsayılan 8). */
  rows?: number | undefined;
  /** Extra check of the parsed value → message or null. @tr Ayrıştırılmış değerin ek denetimi → ileti ya da null. */
  validate?: ((value: unknown) => string | null | undefined) | undefined;
  /** JSON Schema subset (see TreeEditor): problems are listed in the text view and marked on the tree rows. @tr JSON Schema alt kümesi (bkz. TreeEditor): sorunlar metin görünümünde listelenir, ağaç satırlarında işaretlenir. */
  schema?: JsonSchema | undefined;
  /** Format indent (2). @tr Biçimlendirme girintisi (2). */
  indent?: number | undefined;
  /** Tab inserts two spaces (default true). @tr Tab iki boşluk ekler (varsayılan true). */
  tabIndent?: boolean | undefined;
  /** First view (default "text"). @tr İlk görünüm (varsayılan "text"). */
  mode?: JsonMode | undefined;
  /** Views offered (default text and tree); one hides the switcher. @tr Sunulan görünümler (varsayılan text ve tree); tek görünüm seçiciyi gizler. */
  modes?: readonly JsonMode[] | undefined;
  /** Tree levels open at start (default 2). @tr Başta açık olan ağaç düzeyleri (varsayılan 2). */
  expand?: number | undefined;
  /** The Format button under the text (default true). @tr Metnin altındaki Format düğmesi (varsayılan true). */
  format?: boolean | undefined;
  /** The "Valid JSON" confirmation under the text (default true). Problems are shown either way. @tr Metnin altındaki "Valid JSON" onayı (varsayılan true). Sorunlar her durumda gösterilir. */
  status?: boolean | undefined;
  /**
   * Own texts; each falls back to the built-in one: the two views (`text`, `tree`), the switcher's name (`view`), the
   * tree's name (`treeName`), the tooltip of the tree tab while the text is broken (`fixFirst`), `valid`, `format`,
   * `invalid(line, column, message)` and `more(count)` ("+2 more" after the first schema problem).
   * @tr Kendi metinlerin; her biri yerleşik olana döner: iki görünüm (`text`, `tree`), seçicinin adı (`view`), ağacın adı (`treeName`), metin bozukken ağaç sekmesinin ipucu (`fixFirst`), `valid`, `format`, `invalid(line, column, message)` ve `more(count)` (ilk şema sorunundan sonra "+2 more").
   */
  labels?: {
    text?: string; tree?: string; view?: string; treeName?: string; fixFirst?: string; valid?: string; format?: string;
    invalid?: ((line: number | null, column: number | null, message: string) => string) | undefined;
    more?: ((count: number) => string) | undefined;
  } | undefined;
}

// the tree view loads with its first use (forms that only need the text view stay small)
const Tree = lazy(() => import("../tree-editor/index.ts").then((m) => ({ default: m.TreeEditor })), { placeholder: "form" });

/**
 * JSON editor with a text and a tree view: `<JsonEditor bind:value={$data} mode="tree" schema={schema} />`. Value: the
 * parsed JSON (null when empty); while the text is invalid the raw string.
 */
export function JsonEditor(props: JsonEditorProps): unknown {
  const [get, set] = model<unknown>(props, null);
  const id = uid("m-json");
  const L = (): NonNullable<JsonEditorProps["labels"]> => props.labels ?? {};
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
    if (r.error) return { msg: L().invalid?.(r.line, r.column, r.error) ?? t`Invalid JSON at line ${r.line}, column ${r.column}: ${r.error}` };
    const problems = validateJson(r.value, props.schema);
    if (problems.length) return { value: r.value, msg: `${pointer(problems[0]!.path) || "/"}: ${problems[0]!.message}${problems.length > 1 ? ` ${L().more?.(problems.length - 1) ?? t`(+${problems.length - 1} more)`}` : ""}`, problems };
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
  // the text view is a Textarea (mono, Tab indents); the parse / schema message joins the field's own description
  const area = h(Textarea, {
    id: c.id, name: props.name, value: text, onChange: emit, class: "m-json", mono: true, autosize: false, rows: props.rows ?? 8, spellcheck: "false", autocomplete: "off",
    tabIndent: live(() => props.tabIndent !== false), readonly: live(() => props.readonly), disabled: live(() => props.disabled), required: live(() => props.required),
    invalid: live(() => !!status().msg || c["aria-invalid"]() === "true"), describedby: live(() => [status().msg ? msgId : null, c["aria-describedby"]()].filter(Boolean).join(" ") || null),
    "aria-label": live(() => c["aria-label"]()), onBlur: props.onBlur, onFocus: props.onFocus,
  });
  const format = (): void => { const st = status.peek(); if (!("value" in st)) return; emit(st.value == null ? "" : JSON.stringify(st.value, null, props.indent ?? 2)); };

  const LABEL: Record<JsonMode, () => string> = { text: () => L().text ?? t`Text`, tree: () => L().tree ?? t`Tree` };
  // the view switcher: the pill tab strip; the tree tab stays reachable (it explains itself) but does nothing while the text is broken
  const broken = (m: JsonMode): boolean => m === "tree" && !parsed();
  const tabs = () => (modes().length < 2 ? null : h(TabList, {
    variant: "pill", class: "m-json-modes", label: () => L().view ?? t`JSON view`, value: mode, controls: `${id}-panel`, tabId: (m: string) => `${id}-tab-${m}`,
    tabs: modes().map((m) => ({ id: m, label: LABEL[m], title: () => (broken(m) ? L().fixFirst ?? t`Fix the JSON to see the tree` : null) })),
    tabProps: (tab: TabSpec) => ({ class: "m-json-mode", "aria-disabled": () => (broken(tab.id as JsonMode) ? "true" : null) }),
    onSelect: (m: string) => { if (!broken(m as JsonMode)) mode.set(m as JsonMode); },
  }));
  const bar = h("div", { class: "m-json-bar" },
    h("span", { id: msgId, class: () => (status().msg ? "m-field-error" : "m-help"), role: "status" }, () => status().msg ?? (text().trim() && props.status !== false ? L().valid ?? t`Valid JSON` : "")),
    () => (props.readonly || props.format === false ? null : h(Button, { size: "sm", class: "m-json-format", disabled: () => !parsed(), onClick: format }, () => L().format ?? t`Format`)));
  // re-drawn only when the view changes (typing keeps the same textarea and caret)
  const showTree = computed(() => mode() === "tree" && parsed());
  const body = () => {
    if (!showTree()) return [area, bar];
    return untrack(() => h(Tree, {
      // live: a new value from outside while the tree is shown reaches it (its own edits come back the same)
      value: live(() => status().value), onChange: (v: unknown) => { const s = JSON.stringify(v, null, props.indent ?? 2); text.set(s); lastEmitted = v; set(v); },
      // live: switching read-only or disabled reaches the tree at once
      schema: live(() => props.schema), readonly: live(() => props.readonly), disabled: live(() => props.disabled), expand: props.expand, label: L().treeName ?? t`JSON tree`,
      validate: props.validate ? (v: unknown) => { const m = props.validate!(v); return m ? [{ path: [], message: m }] : []; } : undefined,
    }));
  };
  return h("div", { class: () => cx("m-json-editor", `is-${mode()}`, props.class) },
    tabs,
    h("div", { id: `${id}-panel`, class: "m-json-panel", role: () => (modes().length > 1 ? "tabpanel" : null), "aria-labelledby": () => (modes().length > 1 ? `${id}-tab-${mode()}` : null) }, body));
}
