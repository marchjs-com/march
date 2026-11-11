// Structured editors: ListEditor (array of strings), KeyValueEditor (object), JsonEditor, Markdown renderer and editor.
import { signal, computed, effect, untrack, reactive } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { For } from "../dom/flow.ts";
import { t } from "../core/i18n.ts";
import { model, ctl, cx, uid, useField, syncValue, labelledBy } from "./util.js";
import { Textarea } from "./inputs.js";

const iconBtn = (label, text, onClick, disabled) => h("button", { type: "button", class: "hm-icon-btn", "aria-label": label, title: label, onClick, disabled }, text);
const splitLines = (s) => String(s ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

/**
 * Edit an array of strings: add, remove, move up/down; pasting several lines adds one item per line.
 * Props: placeholder, max (items), unique (default true), addLabel.
 */
export function ListEditor(props) {
  const [get, set] = model(props, []);
  const list = () => get() ?? [];
  const idx = computed(() => list().map((_, i) => i), { equals: (a, b) => a?.length === b?.length });
  const field = useField();
  const c = ctl(props);
  const ro = () => !!(props.disabled || props.readonly);
  const full = () => props.max != null && list().length >= props.max;
  const add = (items) => {
    let cur = [...untrack(list)];
    for (const s of items) if (props.unique === false || !cur.includes(s)) cur.push(s);
    if (props.max != null) cur = cur.slice(0, props.max);
    set(cur);
  };
  const move = (i, d) => { const cur = [...untrack(list)]; const j = i + d; if (j < 0 || j >= cur.length) return; [cur[i], cur[j]] = [cur[j], cur[i]]; set(cur); };
  const draft = h("input", {
    type: "text", class: "hm-input", id: props.id ?? field?.id, placeholder: () => props.placeholder ?? t`Add an item`, disabled: () => ro() || full(),
    "aria-invalid": c["aria-invalid"], "aria-describedby": c["aria-describedby"], onBlur: props.onBlur,
    onKeyDown: (e) => { if (e.key === "Enter") { e.preventDefault(); const v = draft.value.trim(); if (v) { add([v]); draft.value = ""; } } },
    onPaste: (e) => { const text = e.clipboardData?.getData("text") ?? ""; const lines = splitLines(text); if (lines.length > 1) { e.preventDefault(); add(lines); draft.value = ""; } },
  });
  return h("div", { class: cx("hm-list-editor", props.class), role: "group", "aria-labelledby": labelledBy(props) },
    h("ol", { class: "hm-list-items" }, h(For, { each: idx }, (i) => {
      const row = h("input", {
        type: "text", class: "hm-input", "aria-label": () => t`Item ${i() + 1}`, readonly: ro,
        onInput: (e) => { const cur = [...untrack(list)]; cur[i.peek()] = e.target.value; set(cur); },
        onBlur: () => { const cur = untrack(list); if (!String(cur[i.peek()] ?? "").trim()) set(cur.filter((_, j) => j !== i.peek())); },
        onPaste: (e) => {
          const lines = splitLines(e.clipboardData?.getData("text"));
          if (lines.length > 1) { e.preventDefault(); const cur = [...untrack(list)]; cur.splice(i.peek(), 1, ...lines); set(cur); }
        },
      });
      syncValue(row, () => list()[i()] ?? "");
      return h("li", { class: "hm-list-row" }, row,
        () => (ro() ? null : [
          iconBtn(t`Move up`, "↑", () => move(i.peek(), -1), () => i() === 0),
          iconBtn(t`Move down`, "↓", () => move(i.peek(), 1), () => i() === list().length - 1),
          iconBtn(t`Remove`, "×", () => set(untrack(list).filter((_, j) => j !== i.peek()))),
        ]));
    })),
    () => (ro() ? null : h("div", { class: "hm-list-add" }, draft,
      h("button", { type: "button", class: "hm-btn", disabled: () => full(), onClick: () => { const lines = splitLines(draft.value); if (lines.length) { add(lines); draft.value = ""; } draft.focus(); } }, () => props.addLabel ?? t`Add`))));
}

/**
 * Edit an object of string → string (or number with `numbers`). Rows keep their order; empty keys are skipped; duplicate
 * keys are flagged. Props: keyPlaceholder, valuePlaceholder, numbers (numeric-looking values become numbers).
 */
export function KeyValueEditor(props) {
  const [get, set] = model(props, {});
  const rows = signal(Object.entries(untrack(get) ?? {}).map(([k, v]) => [k, v == null ? "" : String(v)]), { equals: false });
  let last = JSON.stringify(untrack(get) ?? {});
  const toObj = (rs) => {
    const o = {};
    for (const [k, v] of rs) { const key = k.trim(); if (!key || key in o) continue; o[key] = props.numbers && v.trim() !== "" && !isNaN(Number(v)) ? Number(v) : v; }
    return o;
  };
  const emit = (rs) => { rows.set(rs); const o = toObj(rs); last = JSON.stringify(o); set(o); };
  effect(() => { const v = get() ?? {}; const s = JSON.stringify(v); if (s !== last) { last = s; untrack(() => rows.set(Object.entries(v).map(([k, x]) => [k, x == null ? "" : String(x)]))); } });
  const idx = computed(() => rows().map((_, i) => i), { equals: (a, b) => a?.length === b?.length });
  const dup = (i) => { const rs = rows(); const k = rs[i]?.[0].trim(); return !!k && rs.findIndex((r) => r[0].trim() === k) !== i; };
  const ro = () => !!(props.disabled || props.readonly);
  const field = useField();
  const edit = (i, col, v) => { const rs = rows.peek().map((r) => [...r]); rs[i][col] = v; emit(rs); };
  return h("div", { class: cx("hm-kv-editor", props.class), role: "group", "aria-labelledby": labelledBy(props) },
    h(For, { each: idx }, (i) => {
      const k = h("input", { type: "text", class: "hm-input", id: () => (i() === 0 ? props.id ?? field?.id : null), "aria-label": t`Key`, placeholder: () => props.keyPlaceholder ?? t`Key`, readonly: ro, "aria-invalid": () => (dup(i()) ? "true" : null), onInput: (e) => edit(i.peek(), 0, e.target.value), onBlur: props.onBlur });
      const v = h("input", { type: "text", class: "hm-input", "aria-label": t`Value`, placeholder: () => props.valuePlaceholder ?? t`Value`, readonly: ro, onInput: (e) => edit(i.peek(), 1, e.target.value), onBlur: props.onBlur });
      syncValue(k, () => rows()[i()]?.[0]);
      syncValue(v, () => rows()[i()]?.[1]);
      return h("div", { class: "hm-kv-row" }, k, v,
        () => (ro() ? null : iconBtn(t`Remove`, "×", () => emit(rows.peek().filter((_, j) => j !== i.peek())))),
        () => (dup(i()) ? h("span", { class: "hm-field-error", role: "alert" }, t`Duplicate key`) : null));
    }),
    () => (ro() ? null : h("button", { type: "button", class: "hm-btn hm-kv-add", onClick: () => { rows.set([...rows.peek(), ["", ""]]); } }, t`Add row`)));
}

// ------------------------------------------------------------------ JSON
/** Parse JSON; returns { value } or { error, line, column }. */
export function parseJson(text) {
  try { return { value: JSON.parse(text) }; } catch (e) {
    const msg = String(e.message);
    let line = null, column = null;
    const lc = /line (\d+) column (\d+)/.exec(msg);
    const pos = /position (\d+)/.exec(msg);
    if (lc) [line, column] = [+lc[1], +lc[2]];
    else {
      const p = pos ? +pos[1] : text.length;
      const before = text.slice(0, p).split("\n");
      line = before.length; column = before[before.length - 1].length + 1;
    }
    return { error: msg.replace(/^JSON\.parse: /, "").replace(/ in JSON at position \d+.*$/, "").replace(/\s*\(line \d+ column \d+\)$/, ""), line, column };
  }
}

/**
 * JSON text editor with live validation (message with line / column), a Format button and an optional
 * `validate(value) → message|null`. Value: the parsed JSON (null when empty); while the text is invalid the raw string.
 */
export function JsonEditor(props) {
  const [get, set] = model(props, null);
  const text = signal(untrack(get) == null ? "" : typeof untrack(get) === "string" ? untrack(get) : JSON.stringify(untrack(get), null, 2));
  let lastEmitted = untrack(get);
  effect(() => {
    const v = get();
    if (v === lastEmitted) return;
    lastEmitted = v;
    untrack(() => text.set(v == null ? "" : typeof v === "string" ? v : JSON.stringify(v, null, 2)));
  });
  const status = computed(() => {
    const s = text();
    if (!s.trim()) return { value: null };
    const r = parseJson(s);
    if (r.error) return { msg: t`Invalid JSON at line ${r.line}, column ${r.column}: ${r.error}` };
    const custom = props.validate?.(r.value);
    return custom ? { value: r.value, msg: custom } : { value: r.value };
  });
  const msgId = uid("hm-json");
  const emit = (s) => {
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
    onInput: (e) => emit(e.target.value),
    onKeyDown: (e) => { if (e.key === "Tab" && !e.shiftKey && props.tabIndent !== false) { e.preventDefault(); const el = e.target, a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? a; el.value = el.value.slice(0, a) + "  " + el.value.slice(b); el.selectionStart = el.selectionEnd = a + 2; emit(el.value); } },
  });
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
export const isSafeLink = (u) => {
  const s = String(u ?? "").replace(/[\u0000-\u0020\u007f-\u009f]/g, "");
  return s.length > 0 && (SAFE_URL.test(s) || (!/^[a-z][a-z0-9+.-]*:/i.test(s) && !s.startsWith("//") && !/^[^/?#]*:/.test(s)));
};

function inline(src, opts) {
  const out = [];
  let buf = "";
  const flush = () => { if (buf) { out.push(buf); buf = ""; } };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m;
    if (rest[0] === "\\" && /^\\[\\`*_[\]()#+\-.!~>]/.test(rest)) { buf += rest[1]; i += 2; continue; }
    if ((m = /^`([^`]+)`/.exec(rest))) { flush(); out.push(h("code", null, m[1])); i += m[0].length; continue; }
    if ((m = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/.exec(rest))) {
      flush();
      out.push(opts.images !== false && /^https:\/\//i.test(m[2]) ? h("img", { src: m[2], alt: m[1], loading: "lazy" }) : m[1]);
      i += m[0].length; continue;
    }
    if ((m = /^\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/.exec(rest))) {
      flush();
      const kids = inline(m[1], opts);
      out.push(isSafeLink(m[2]) ? h("a", { href: m[2], rel: "noopener noreferrer nofollow", target: /^https?:/i.test(m[2]) && opts.newTab !== false ? "_blank" : null }, kids) : h("span", null, kids));
      i += m[0].length; continue;
    }
    if ((m = /^<(https?:\/\/[^>\s]+)>/.exec(rest))) { flush(); out.push(h("a", { href: m[1], rel: "noopener noreferrer nofollow" }, m[1])); i += m[0].length; continue; }
    if ((m = /^(\*\*|__)(?=\S)([\s\S]*?\S)\1/.exec(rest))) { flush(); out.push(h("strong", null, inline(m[2], opts))); i += m[0].length; continue; }
    if ((m = /^~~(?=\S)([\s\S]*?\S)~~/.exec(rest))) { flush(); out.push(h("del", null, inline(m[1], opts))); i += m[0].length; continue; }
    if ((m = /^(\*|_)(?=\S)([\s\S]*?\S)\1(?![*_\w])/.exec(rest)) && !(rest[0] === "_" && /\w/.test(src[i - 1] ?? ""))) { flush(); out.push(h("em", null, inline(m[2], opts))); i += m[0].length; continue; }
    buf += rest[0];
    i++;
  }
  flush();
  return out;
}

/** Parse Markdown into DOM nodes (never HTML strings). HTML in the source is shown as text. */
export function markdownNodes(source, opts = {}) {
  const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;
  const isBlockStart = (l) => /^(#{1,6})\s|^```|^>|^\s*([-*+]|\d+[.)])\s|^(\*{3,}|-{3,}|_{3,})\s*$/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    let m;
    if (!line.trim()) { i++; continue; }
    if ((m = /^```\s*([\w-]*)\s*$/.exec(line))) {
      const code = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
      i++;
      out.push(h("pre", null, h("code", { class: m[1] ? `language-${m[1]}` : null }, code.join("\n"))));
      continue;
    }
    if ((m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line))) { const lvl = Math.min(6, m[1].length + (opts.headingOffset ?? 0)); out.push(h(`h${lvl}`, null, inline(m[2], opts))); i++; continue; }
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) { out.push(h("hr", null)); i++; continue; }
    if (/^>/.test(line)) {
      const q = [];
      while (i < lines.length && /^>/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
      out.push(h("blockquote", null, markdownNodes(q.join("\n"), opts)));
      continue;
    }
    if ((m = /^\s*([-*+]|\d+[.)])\s+/.exec(line))) {
      const ordered = /\d/.test(m[1]);
      const items = [];
      const re = ordered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
      while (i < lines.length) {
        const im = re.exec(lines[i]);
        if (im) { items.push(im[1]); i++; }
        else if (lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1] += ` ${lines[i].trim()}`; i++; }
        else break;
      }
      const start = ordered ? parseInt(m[1], 10) : null;
      out.push(h(ordered ? "ol" : "ul", { start: start && start !== 1 ? start : null }, items.map((it) => {
        const task = /^\[([ xX])\]\s+(.*)$/.exec(it);
        return task ? h("li", { class: "hm-task" }, h("input", { type: "checkbox", disabled: true, checked: task[1] !== " " }), " ", inline(task[2], opts)) : h("li", null, inline(it, opts));
      })));
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !(para.length && isBlockStart(lines[i]))) para.push(lines[i++]);
    const kids = [];
    para.forEach((l, j) => {
      const hard = / {2,}$/.test(l);
      kids.push(...inline(l.trim(), opts));
      if (j < para.length - 1) kids.push(hard ? h("br", null) : " ");
    });
    out.push(h("p", null, kids));
  }
  return out;
}

/** Render Markdown safely. Props: source (or a string child), images (default true, https only), newTab (default true). */
export function Markdown(props) {
  return h("div", { class: cx("hm-markdown", props.class) }, () => markdownNodes(props.source ?? props.children ?? "", { images: props.images, newTab: props.newTab, headingOffset: props.headingOffset }));
}

/** Markdown textarea with Write / Preview tabs. Props: rows, placeholder, preview ("tab" default, or "split"). */
export function MarkdownEditor(props) {
  const [get, set] = model(props, "");
  const tab = signal("write");
  const id = uid("hm-md");
  const split = props.preview === "split";
  const tabBtn = (name, label) => h("button", {
    type: "button", role: "tab", class: "hm-tab", id: `${id}-${name}`, "aria-selected": () => String(tab() === name), "aria-controls": `${id}-${name}-panel`,
    tabindex: () => (tab() === name ? "0" : "-1"), onClick: () => tab.set(name),
    onKeyDown: (e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const n = tab.peek() === "write" ? "preview" : "write"; tab.set(n); globalThis.document?.getElementById(`${id}-${n}`)?.focus(); } },
  }, label);
  const tp = ctlProps(props);
  Object.defineProperty(tp, "value", { get, enumerable: true });
  Object.assign(tp, { setValue: set, rows: props.rows ?? 8 });
  const editor = Textarea(tp);
  const preview = h(Markdown, { source: reactive(() => get()) });
  if (split) return h("div", { class: cx("hm-md-editor hm-md-split", props.class) }, editor, h("div", { class: "hm-md-preview" }, preview));
  return h("div", { class: cx("hm-md-editor", props.class) },
    h("div", { role: "tablist", class: "hm-tabs", "aria-label": t`Editor mode` }, tabBtn("write", t`Write`), tabBtn("preview", t`Preview`)),
    h("div", { role: "tabpanel", id: `${id}-write-panel`, "aria-labelledby": `${id}-write`, hidden: () => tab() !== "write" }, editor),
    h("div", { role: "tabpanel", id: `${id}-preview-panel`, class: "hm-md-preview", "aria-labelledby": `${id}-preview`, hidden: () => tab() !== "preview" }, () => (tab() === "preview" ? preview : null)));
}

// Live props a wrapped Textarea should keep (getters preserved).
function ctlProps(props) {
  const o = {};
  for (const k of ["id", "name", "placeholder", "disabled", "readonly", "required", "onBlur", "invalid", "describedby"]) {
    const d = Object.getOwnPropertyDescriptor(props, k);
    if (d) Object.defineProperty(o, k, d);
  }
  return o;
}
