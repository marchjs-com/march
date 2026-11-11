// Structured editors: ListEditor (array of strings), KeyValueEditor (object), JsonEditor, Markdown renderer and editor.
import { signal, computed, effect, untrack, type Accessor } from "../core/reactive.ts";
import { svgIcon, type IconDef } from "../icons/svg.ts";
import { arrowUp, arrowDown, x as xIcon } from "../icons/set.ts";
import { h } from "../dom/h.ts";
import { For } from "../dom/flow.ts";
import { t } from "../core/i18n.ts";
import { model, ctl, cx, uid, useField, syncValue, labelledBy, live, type ControlProps, type ClassProp } from "./util.ts";
import { Textarea, type TextareaProps } from "./inputs.ts";

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

// ------------------------------------------------------------------ JSON
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
  /** Format indent (2). */
  indent?: number | undefined;
  /** Tab inserts two spaces (default true). */
  tabIndent?: boolean | undefined;
}

/**
 * JSON text editor with live validation (message with line / column), a Format button and an optional
 * `validate(value) → message|null`. Value: the parsed JSON (null when empty); while the text is invalid the raw string.
 */
export function JsonEditor(props: JsonEditorProps): unknown {
  const [get, set] = model<unknown>(props, null);
  const text = signal(untrack(get) == null ? "" : typeof untrack(get) === "string" ? untrack(get) as string : JSON.stringify(untrack(get), null, 2));
  let lastEmitted = untrack(get);
  effect(() => {
    const v = get();
    if (v === lastEmitted) return;
    lastEmitted = v;
    untrack(() => text.set(v == null ? "" : typeof v === "string" ? v : JSON.stringify(v, null, 2)));
  });
  const status = computed((): { value?: unknown; msg?: string } => {
    const s = text();
    if (!s.trim()) return { value: null };
    const r = parseJson(s);
    if (r.error) return { msg: t`Invalid JSON at line ${r.line}, column ${r.column}: ${r.error}` };
    const custom = props.validate?.(r.value);
    return custom ? { value: r.value, msg: custom } : { value: r.value };
  });
  const msgId = uid("hm-json");
  const emit = (s: string) => {
    text.set(s);
    const st = status.peek();
    lastEmitted = "value" in st ? st.value : s;
    set(lastEmitted);
  };
  const c = ctl(props);
  const area = h("textarea", {
    ...c, class: "hm-input hm-textarea hm-mono hm-json", rows: props.rows ?? 8, spellcheck: "false", autocomplete: "off", readonly: () => !!props.readonly,
    "aria-invalid": () => (status().msg || c["aria-invalid"]() ? "true" : null),
    "aria-describedby": () => [status().msg ? msgId : null, c["aria-describedby"]()].filter(Boolean).join(" ") || null,
    onInput: (e: Event) => emit((e.target as HTMLTextAreaElement).value),
    onKeyDown: (e: KeyboardEvent) => { if (e.key === "Tab" && !e.shiftKey && props.tabIndent !== false) { e.preventDefault(); const el = e.target as HTMLTextAreaElement, a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? a; el.value = el.value.slice(0, a) + "  " + el.value.slice(b); el.selectionStart = el.selectionEnd = a + 2; emit(el.value); } },
  }) as HTMLTextAreaElement;
  syncValue(area, text);
  const format = () => { const st = status.peek(); if (st.msg && !("value" in st)) return; emit(st.value == null ? "" : JSON.stringify(st.value, null, props.indent ?? 2)); };
  return h("div", { class: cx("hm-json-editor", props.class) }, area,
    h("div", { class: "hm-json-bar" },
      h("span", { id: msgId, class: () => (status().msg ? "hm-field-error" : "hm-help"), role: "status" }, () => status().msg ?? (text().trim() ? t`Valid JSON` : "")),
      props.readonly ? null : h("button", { type: "button", class: "hm-btn hm-btn-sm", disabled: () => !!status().msg && !("value" in status()), onClick: format }, t`Format`)));
}

// ------------------------------------------------------------------ Markdown (safe subset, DOM only)
const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#|\.{1,2}\/)/i;
/** True for URLs the Markdown renderer will link (http(s), mailto, tel, relative). */
export const isSafeLink = (u: unknown): boolean => {
  const s = String(u ?? "").replace(/[\u0000- \u007f-\u009f]/g, "");
  return s.length > 0 && (SAFE_URL.test(s) || (!/^[a-z][a-z0-9+.-]*:/i.test(s) && !s.startsWith("//") && !/^[^/?#]*:/.test(s)));
};

/** Options of markdownNodes(). */
export interface MarkdownOptions {
  /** Render https images (default true). */
  images?: boolean | undefined;
  /** Open http(s) links in a new tab (default true). */
  newTab?: boolean | undefined;
  /** Added to heading levels (max h6). */
  headingOffset?: number | undefined;
}

function inline(src: string, opts: MarkdownOptions): (Node | string)[] {
  const out: (Node | string)[] = [];
  let buf = "";
  const flush = () => { if (buf) { out.push(buf); buf = ""; } };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpExecArray | null;
    if (rest[0] === "\\" && /^\\[\\`*_[\]()#+\-.!~>]/.test(rest)) { buf += rest[1]; i += 2; continue; }
    if ((m = /^`([^`]+)`/.exec(rest))) { flush(); out.push(h("code", null, m[1])); i += m[0].length; continue; }
    if ((m = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/.exec(rest))) {
      flush();
      out.push(opts.images !== false && /^https:\/\//i.test(m[2]!) ? h("img", { src: m[2], alt: m[1], loading: "lazy" }) : m[1]!);
      i += m[0].length; continue;
    }
    if ((m = /^\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/.exec(rest))) {
      flush();
      const kids = inline(m[1]!, opts);
      out.push(isSafeLink(m[2]) ? h("a", { href: m[2], rel: "noopener noreferrer nofollow", target: /^https?:/i.test(m[2]!) && opts.newTab !== false ? "_blank" : null }, kids) : h("span", null, kids));
      i += m[0].length; continue;
    }
    if ((m = /^<(https?:\/\/[^>\s]+)>/.exec(rest))) { flush(); out.push(h("a", { href: m[1], rel: "noopener noreferrer nofollow" }, m[1])); i += m[0].length; continue; }
    if ((m = /^(\*\*|__)(?=\S)([\s\S]*?\S)\1/.exec(rest))) { flush(); out.push(h("strong", null, inline(m[2]!, opts))); i += m[0].length; continue; }
    if ((m = /^~~(?=\S)([\s\S]*?\S)~~/.exec(rest))) { flush(); out.push(h("del", null, inline(m[1]!, opts))); i += m[0].length; continue; }
    if ((m = /^(\*|_)(?=\S)([\s\S]*?\S)\1(?![*_\w])/.exec(rest)) && !(rest[0] === "_" && /\w/.test(src[i - 1] ?? ""))) { flush(); out.push(h("em", null, inline(m[2]!, opts))); i += m[0].length; continue; }
    buf += rest[0];
    i++;
  }
  flush();
  return out;
}

/** Parse Markdown into DOM nodes (never HTML strings). HTML in the source is shown as text. */
export function markdownNodes(source: unknown, opts: MarkdownOptions = {}): Element[] {
  const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out: Element[] = [];
  let i = 0;
  const isBlockStart = (l: string) => /^(#{1,6})\s|^```|^>|^\s*([-*+]|\d+[.)])\s|^(\*{3,}|-{3,}|_{3,})\s*$/.test(l);
  while (i < lines.length) {
    const line = lines[i]!;
    let m: RegExpExecArray | null;
    if (!line.trim()) { i++; continue; }
    if ((m = /^```\s*([\w-]*)\s*$/.exec(line))) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i]!)) code.push(lines[i++]!);
      i++;
      out.push(h("pre", null, h("code", { class: m[1] ? `language-${m[1]}` : null }, code.join("\n"))));
      continue;
    }
    if ((m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line))) { const lvl = Math.min(6, m[1]!.length + (opts.headingOffset ?? 0)); out.push(h(`h${lvl}`, null, inline(m[2]!, opts))); i++; continue; }
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) { out.push(h("hr", null)); i++; continue; }
    if (/^>/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^>/.test(lines[i]!)) q.push(lines[i++]!.replace(/^>\s?/, ""));
      out.push(h("blockquote", null, markdownNodes(q.join("\n"), opts)));
      continue;
    }
    if ((m = /^\s*([-*+]|\d+[.)])\s+/.exec(line))) {
      const ordered = /\d/.test(m[1]!);
      const items: string[] = [];
      const re = ordered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
      while (i < lines.length) {
        const im = re.exec(lines[i]!);
        if (im) { items.push(im[1]!); i++; }
        else if (lines[i]!.trim() && /^\s{2,}\S/.test(lines[i]!) && items.length) { items[items.length - 1] += ` ${lines[i]!.trim()}`; i++; }
        else break;
      }
      const start = ordered ? parseInt(m[1]!, 10) : null;
      out.push(h(ordered ? "ol" : "ul", { start: start && start !== 1 ? start : null }, items.map((it) => {
        const task = /^\[([ xX])\]\s+(.*)$/.exec(it);
        return task ? h("li", { class: "hm-task" }, h("input", { type: "checkbox", disabled: true, checked: task[1] !== " " }), " ", inline(task[2]!, opts)) : h("li", null, inline(it, opts));
      })));
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !(para.length && isBlockStart(lines[i]!))) para.push(lines[i++]!);
    const kids: (Node | string)[] = [];
    para.forEach((l, j) => {
      const hard = / {2,}$/.test(l);
      kids.push(...inline(l.trim(), opts));
      if (j < para.length - 1) kids.push(hard ? h("br", null) : " ");
    });
    out.push(h("p", null, kids));
  }
  return out;
}

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

export interface MarkdownEditorProps extends ControlProps<string> {
  rows?: number | undefined;
  placeholder?: string | undefined;
  /** "tab" (default): Write / Preview tabs; "split": side by side. */
  preview?: "tab" | "split" | undefined;
}

/** Markdown textarea with Write / Preview tabs. Props: rows, placeholder, preview ("tab" default, or "split"). */
export function MarkdownEditor(props: MarkdownEditorProps): unknown {
  const [get, set] = model(props, "");
  const tab = signal("write");
  const id = uid("hm-md");
  const split = props.preview === "split";
  const tabBtn = (name: string, label: string) => h("button", {
    type: "button", role: "tab", class: "hm-editor-tab", id: `${id}-${name}`, "aria-selected": () => String(tab() === name), "aria-controls": `${id}-${name}-panel`,
    tabindex: () => (tab() === name ? "0" : "-1"), onClick: () => tab.set(name),
    onKeyDown: (e: KeyboardEvent) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const n = tab.peek() === "write" ? "preview" : "write"; tab.set(n); globalThis.document?.getElementById(`${id}-${n}`)?.focus(); } },
  }, label);
  const tp = ctlProps(props);
  Object.defineProperty(tp, "value", { get, enumerable: true });
  Object.assign(tp, { setValue: set, rows: props.rows ?? 8 });
  const editor = Textarea(tp);
  const preview = h(Markdown, { source: live(() => get()) });
  if (split) return h("div", { class: cx("hm-md-editor hm-md-split", props.class) }, editor, h("div", { class: "hm-md-preview" }, preview));
  return h("div", { class: cx("hm-md-editor", props.class) },
    h("div", { role: "tablist", class: "hm-editor-tabs", "aria-label": t`Editor mode` }, tabBtn("write", t`Write`), tabBtn("preview", t`Preview`)),
    h("div", { role: "tabpanel", id: `${id}-write-panel`, "aria-labelledby": `${id}-write`, hidden: () => tab() !== "write" }, editor),
    h("div", { role: "tabpanel", id: `${id}-preview-panel`, class: "hm-md-preview", "aria-labelledby": `${id}-preview`, hidden: () => tab() !== "preview" }, () => (tab() === "preview" ? preview : null)));
}

// Live props a wrapped Textarea should keep (getters preserved).
function ctlProps(props: MarkdownEditorProps): TextareaProps {
  const o: TextareaProps = {};
  for (const k of ["id", "name", "placeholder", "disabled", "readonly", "required", "onBlur", "invalid", "describedby"]) {
    const d = Object.getOwnPropertyDescriptor(props, k);
    if (d) Object.defineProperty(o, k, d);
  }
  return o;
}
