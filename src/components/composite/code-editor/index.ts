// CodeEditor (hadi-march/ui): a small code field: the text is coloured as it is typed (the CodeView colours, so
// unfinished code too), a suggestion list opens at the caret (you supply `complete`; `jsxCompleter` is the ready one
// for a JSX tag: prop names, then values inside quotes), ranges can be marked (a short flash, an error underline) and
// a foot line says what the owner thinks of the code. It does not run or compile anything: the owner reads `value`.
// Built from EditorFrame (border, focus ring, foot bar), Popover + OptionList (the suggestions; the keys stay in the
// text), CopyButton (icon only), Dropdown (the shortcuts menu), Kbd and StatusDot. The keys are an IDE's: Tab indents,
// Shift+Tab outdents, Enter keeps the indent, Ctrl+/ comments, Alt+arrows move lines, Ctrl+S saves (onSave)…
import "../../typography/code-view/code-view.css"; // the token colours (.m-tok-*)
import "./code-editor.css";
import { signal, computed, effect, untrack, batch } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { uid } from "../../../core/util.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { model, syncValue, type ControlProps } from "../../../forms/util.ts";
import { tokenize } from "../../../ui/highlight.ts";
import { virtualAnchor } from "../../../ui/popover.ts";
import { Popover } from "../../overlays/popover/index.ts";
import { animate } from "../../../motion/animate.ts";
import { EditorFrame } from "../editor-frame/index.ts";
import { OptionList } from "../../forms/option-list/index.ts";
import { CopyButton } from "../../actions/copy-button/index.ts";
import { Kbd } from "../../typography/kbd/index.ts";
import { Chip } from "../../actions/chip/index.ts";
import { StatusDot } from "../../feedback/status-dot/index.ts";
import { Dropdown } from "../../actions/menu/index.ts";
import { command as commandIcon } from "../../../icons/glyphs/command.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { withColor } from "../../../theme/colors.ts";

export { jsxCompleter, type JsxProp } from "./jsx.ts";

messages("tr", {
  "Code": "Kod", "Suggestions": "Öneriler", "suggestions": "öneriler", "Copy": "Kopyala", "Suggestion source": "Önerilerin kaynağı", "No suggestions here": "Bu kaynakta öneri yok",
  "Keyboard shortcuts": "Klavye kısayolları", "Editor": "Editör", "Indent (or take the suggestion)": "Girinti (ya da öneriyi al)", "Outdent": "Girintiyi azalt",
  "New line, keeping the indent": "Yeni satır, girinti korunur", "Comment / uncomment lines": "Satırları yorum yap / aç", "Move lines up": "Satırları yukarı taşı",
  "Move lines down": "Satırları aşağı taşı", "Copy lines up": "Satırları yukarı kopyala", "Copy lines down": "Satırları aşağı kopyala", "Delete lines": "Satırları sil",
  "Suggestions list": "Öneri listesi", "Save": "Kaydet", "Leave the editor": "Editörden çık", "Toggle a breakpoint": "Kesme noktası koy / kaldır",
  "Undo / redo": "Geri al / yinele",
});

/** One row of the suggestion list. */
export interface CodeSuggestion {
  /** What the row shows (and what is inserted when `insert` is not given). */
  label: string;
  /** A short note beside it: the type, what it does. */
  hint?: string;
  /** The text that replaces the word being written (default: `label`). */
  insert?: string;
  /** Move the caret back this many characters after the insert (into the quotes of `variant=""`). */
  back?: number;
  /** Ask for suggestions again right after the insert (the values of the prop just written). */
  again?: boolean;
  /** Where the row comes from ("march", "ts", "js"…): the `sources` chips under the list filter by it. */
  source?: string;
  /** A line written at the top of the text with the pick, when the text does not have it yet (the row's import). */
  head?: string;
  /** A heading the row is listed under ("Methods", "Properties"); rows of a group follow one another. */
  group?: string;
}
/** A chip under the suggestion list: rows whose `source` is `value` ("all": every row). */
export interface CodeSource { value: string; label: string }
/** What `complete` returns: the rows and the range of the text they replace. */
export interface CodeCompletion { from: number; to?: number; items: readonly CodeSuggestion[]; /** Every row, whatever source chip is chosen (and no chips): a member list. */ all?: boolean }
/** Where the caret is when suggestions are asked for. */
export interface CodeCompleteContext {
  value: string;
  caret: number;
  /** The text before the caret. */
  before: string;
  /** Asked by Ctrl + Space (or after a pick with `again`): suggest even with nothing typed. */
  forced: boolean;
  /** The character just typed ("" when asked by a key). */
  typed: string;
}
/** A marked range of the text: "flash" lights up once, "error" and "warning" stay underlined (red, amber). */
export interface CodeMark { from: number; to: number; kind?: "flash" | "error" | "warning"; /** Shown as the mark's tooltip (the problem). */ title?: string }
/**
 * A mark in the gutter beside a line's number (1-based): its `kind` becomes a class (`is-<kind>`). Drawn ones:
 * "breakpoint" (a red dot), "conditional" (amber), "log" (a diamond), "off" (a hollow dot); any other kind is yours to style.
 */
export interface CodeLineMark { line: number; kind?: string; /** The mark's tooltip. */ title?: string }
/** The lit line (a debugger's paused line): its number and kind (class `is-<kind>`, default "current"). */
export interface CodeActiveLine { line: number; kind?: string }
/** A row of the shortcuts menu: the keys ("Ctrl+S", "Alt+↑") and what they do. */
export interface CodeShortcut { keys: string; label: MaybeFn<string>; group?: MaybeFn<string | undefined> }
/** The editor's own keys (each can be turned off with `keys={{ comment: false }}`). */
export type CodeCommand = "indent" | "outdent" | "newline" | "comment" | "moveUp" | "moveDown" | "copyUp" | "copyDown" | "deleteLine" | "suggest" | "save" | "release";

export interface CodeEditorProps extends ControlProps<string> {
  /** Colours: js / ts / jsx / tsx (default "tsx"), css, html, json, sh; "" for none. */
  lang?: string | undefined;
  /** Suggestions for the caret's place: called after typing and on Ctrl + Space; null / no items: no list. A promise
   * (a language service in a worker) opens the list when it resolves, if the text and the caret did not move. */
  complete?: ((ctx: CodeCompleteContext) => CodeCompletion | null | undefined | Promise<CodeCompletion | null | undefined>) | undefined;
  /** Marked ranges (reactive). */
  marks?: MaybeFn<readonly CodeMark[] | undefined>;
  /** The foot line: what the owner says about the code (a text or a node; reactive). `false`: no foot bar. */
  message?: MaybeFn<unknown>;
  /** The dot before the message: "ok" (default) or "error". `false`: no dot. */
  status?: MaybeFn<"ok" | "error" | false | undefined>;
  /** Your own node at the end of the foot line, before the shortcuts and copy buttons (default none). */
  hint?: unknown;
  /**
   * The editor's keys, as in an IDE: Tab / Shift+Tab indent and outdent (the lines of a selection too), Enter keeps the
   * indent (one more after `{ ( [`), Ctrl+/ comments lines, Alt+↑ / ↓ move them, Shift+Alt+↑ / ↓ copy them,
   * Ctrl+Shift+K deletes them, Ctrl+Space suggests, Ctrl+S saves (`onSave`), Esc then Tab leaves the editor. `false`:
   * none (Tab moves the focus); `{ comment: false, … }` turns single ones off.
   */
  keys?: false | Partial<Record<CodeCommand, boolean>> | undefined;
  /** Spaces of one indent (default 2). */
  tabSize?: number | undefined;
  /** Ctrl+S (⌘S): the owner saves (the browser's own "save page" does not open). */
  onSave?: ((value: string) => void) | undefined;
  /** The shortcuts button in the foot line: a menu of every key (default true). */
  shortcuts?: boolean | undefined;
  /** More rows for the shortcuts menu: the app's keys (a debugger's F5…), shown under the editor's. */
  moreShortcuts?: MaybeFn<readonly CodeShortcut[] | undefined>;
  /** Name of the shortcuts button and its menu (default "Keyboard shortcuts", translated). */
  shortcutsLabel?: MaybeFn<string> | undefined;
  /** The copy button (default true). */
  copy?: boolean | undefined;
  /** Text of the copy button (default "Copy", translated). */
  copyLabel?: MaybeFn<string> | undefined;
  /** Accessible name of the text field (default "Code", translated). */
  label?: MaybeFn<string | undefined>;
  /** Accessible name of the suggestion list (default "Suggestions", translated). */
  suggestionsLabel?: MaybeFn<string | undefined>;
  /**
   * Chips under the suggestion list that filter the rows by their `source`: `[{ value: "march", label: "March" },
   * { value: "all", label: "All" }]`. None (default): no chips, every row shows.
   */
  sources?: readonly CodeSource[] | undefined;
  /**
   * How suggestions come while typing: "list" (default: the list opens) or "ghost" (the likeliest row is written
   * faintly after the caret, a match of the same case first; Tab takes it). Ctrl + Space opens the list either way.
   */
  suggest?: "list" | "ghost" | undefined;
  /** Characters that open the list even with suggest="ghost" (default "."): `console.` lists its members. */
  listOn?: string | undefined;
  /** The chosen chip (default: the first); `onSourceChange` tells the owner (to keep it). */
  source?: MaybeFn<string | undefined>;
  onSourceChange?: ((value: string) => void) | undefined;
  /** Enter writes a new line (default true); false: one line of code, Enter does nothing. */
  multiline?: boolean | undefined;
  /** How a "flash" mark shows: "glow" (default) or "none" / false. */
  flash?: "glow" | "none" | false | undefined;
  /** Called when focus leaves the editor (the owner may tidy the code). */
  onBlur?: ((e: FocusEvent) => void) | undefined;
  /** The textarea (to focus it, to read the selection). */
  inputRef?: ((el: HTMLTextAreaElement) => void) | undefined;
  /** Line numbers in a gutter at the start of each line (wrapped lines keep one number). */
  lineNumbers?: MaybeFn<boolean | undefined>;
  /** Marks in the gutter, by line (breakpoints…); shown with `lineNumbers`. */
  lineMarks?: MaybeFn<readonly CodeLineMark[] | undefined>;
  /** A line lit across the editor (a debugger's paused line): a number or `{ line, kind }`; scrolled into view when it changes. */
  activeLine?: MaybeFn<CodeActiveLine | number | null | undefined>;
  /** A press on the gutter at a line, or F9 at the caret's line (toggle a breakpoint…). */
  onGutter?: ((line: number, e: MouseEvent | KeyboardEvent) => void) | undefined;
  class?: ClassProp;
}

/** `<CodeEditor bind:value={$code} complete={jsxCompleter({ tag: "Button", props })} message={$note} />` */
export function CodeEditor(props: CodeEditorProps): Element {
  const [get, set] = model(props, "");
  const id = uid("m-ced");
  const ro = (): boolean => !!(props.readonly || props.disabled);
  const done = signal<{ from: number; to: number; items: readonly CodeSuggestion[]; all?: boolean } | null>(null);
  const active = signal(0);
  const marks = (): readonly CodeMark[] => val(props.marks) ?? [];
  // suggest="ghost": the rest of the likeliest row, shown faintly at the caret (`at`); Tab writes it
  const ghost = signal<{ from: number; at: number; rest: string; item: CodeSuggestion } | null>(null);
  // the source chips: the rows shown are the chosen source's ("all": every row)
  const chosen = signal(untrack(() => val(props.source)) ?? props.sources?.[0]?.value ?? "all");
  effect(() => { const s = val(props.source); if (s) chosen.set(s); });
  const shown = computed((): readonly CodeSuggestion[] => { const d = done(), items = d?.items ?? [], s = chosen(); return !props.sources || s === "all" || d?.all ? items : items.filter((it) => it.source === s); });

  // ---- the coloured copy under the (transparent) text field: same text, same wrapping
  const seen = new Set<string>();
  const gutter = (): boolean => !!val(props.lineNumbers);
  const lit = (): CodeActiveLine | null => { const a = val(props.activeLine); return a == null ? null : typeof a === "number" ? { line: a } : a; };
  const paint = (): unknown => {
    const src = get(), list = [...marks()].filter((m) => m.to > m.from).sort((a, b) => a.from - b.from);
    const out: unknown[] = [], now = new Set<string>();
    let at = 0;
    // the gutter: a number (and its mark) at each line's start, the lit line's bar behind it; the tokens are cut there
    const starts: number[] = [];
    const lineMark = new Map<number, CodeLineMark>();
    const active = gutter() ? lit() : null;
    if (gutter()) {
      starts.push(0);
      for (let i = src.indexOf("\n"); i >= 0; i = src.indexOf("\n", i + 1)) starts.push(i + 1);
      for (const m of val(props.lineMarks) ?? []) lineMark.set(m.line, m);
    }
    let next = 0;
    const lineNode = (n: number): unknown => {
      const m = lineMark.get(n);
      return [active?.line === n ? h("span", { class: `m-ced-lit is-${active.kind ?? "current"}`, "aria-hidden": "true" }) : null,
        h("span", { class: cx("m-ced-ln", m && `is-${m.kind ?? "breakpoint"}`), "data-line": n, title: m?.title ?? null })];
    };
    const g = ghost();
    let ghostDone = !g;
    const ghostNode = (): unknown => h("span", { class: "m-ced-ghost-at" }, h("span", { class: "m-ced-ghost" }, g?.rest ?? ""));
    const push = (kind: string, text: string, mark: CodeMark | null): void => {
      const node = kind ? h("span", { class: `m-tok-${kind}` }, text) : text;
      if (!mark) { out.push(node); return; }
      const key = `${mark.kind ?? "flash"}:${mark.from}:${mark.to}:${src.slice(mark.from, mark.to)}`;
      const flash = (mark.kind ?? "flash") === "flash";
      const el = h("mark", { class: flash ? "m-ced-mark is-flash" : `m-ced-mark is-${mark.kind === "warning" ? "warning" : "error"}`, title: mark.title ?? null }, node, flash && props.flash !== "none" && props.flash !== false && !seen.has(key) ? h("i", { class: "m-ced-glow", "data-k": key }) : null);
      now.add(key);
      out.push(el);
    };
    for (const [kind, text] of tokenize(src, props.lang ?? "tsx")) {
      // a token is cut where a mark starts or ends
      let from = at;
      const end = at + text.length;
      while (from < end) {
        while (next < starts.length && starts[next]! <= from) { out.push(lineNode(next + 1)); next++; }
        if (!ghostDone && g!.at === from) { out.push(ghostNode()); ghostDone = true; }
        const m = list.find((x) => x.from < end && x.to > from) ?? null;
        let stop = m ? (m.from > from ? m.from : Math.min(m.to, end)) : end;
        if (!ghostDone && g!.at > from && g!.at < stop) stop = g!.at;
        if (next < starts.length && starts[next]! > from && starts[next]! < stop) stop = starts[next]!;
        push(kind, text.slice(from - at, stop - at), m && m.from <= from ? m : null);
        from = stop;
      }
      at = end;
    }
    seen.clear(); for (const k of now) seen.add(k);
    while (next < starts.length) { out.push(lineNode(next + 1)); next++; } // an empty last line
    if (!ghostDone) out.push(ghostNode());
    out.push("​"); // the last (empty) line keeps its height
    return out;
  };
  const code = h("code", {}, paint) as HTMLElement;
  const pre = h("pre", { class: "m-ced-paint", "aria-hidden": "true" }, code) as HTMLElement;
  // a new flash mark glows once (motion engine: reduced motion and global speed apply)
  effect(() => {
    get(); marks();
    queueMicrotask(() => { for (const g of code.querySelectorAll?.(".m-ced-glow") ?? []) if (!g.hasAttribute("data-on")) { g.setAttribute("data-on", ""); animate(g, { opacity: [1, 0] }, { duration: 1100, easing: "easeOutCubic" }); } });
  });

  // ---- suggestions
  const ask = (forced: boolean, typed = ""): void => {
    // the list (not the ghost): asked for, already open (typing on narrows it), or a member is next (".")
    const list = forced || !!done.peek() || (!!typed && (props.listOn ?? ".").includes(typed.slice(-1)));
    if (!props.complete || ro()) return;
    const caret = input.selectionStart ?? input.value.length;
    const r = props.complete({ value: input.value, caret, before: input.value.slice(0, caret), forced, typed });
    const show = (c: CodeCompletion | null | undefined): void => {
      if (!list && props.suggest === "ghost") { ghost.set(likeliest(c, caret)); return; }
      ghost.set(null);
      // the rows that fit what is typed since the list's start (console.lo → log): starting with it first, then holding it
      const word = c ? input.value.slice(c.from, caret).toLowerCase() : "";
      const items = !c || !word ? c?.items ?? [] : [
        ...c.items.filter((it) => it.label.toLowerCase().startsWith(word)),
        ...c.items.filter((it) => !it.label.toLowerCase().startsWith(word) && it.label.toLowerCase().includes(word)),
      ];
      batch(() => { active.set(0); done.set(c && items.length ? { from: c.from, to: c.to ?? caret, items, ...(c.all ? { all: true } : {}) } : null); });
    };
    // a language service answers later: the list opens only when the text and the caret are still where they were
    if (r && typeof (r as Promise<unknown>).then === "function") {
      const value = input.value, n = ++asked;
      void (r as Promise<CodeCompletion | null | undefined>).then((c) => { if (n === asked && input.value === value && (input.selectionStart ?? -1) === caret) show(c); }, () => undefined);
      return;
    }
    show(r as CodeCompletion | null | undefined);
  };
  let asked = 0;
  /** The row the ghost shows: the word written so far, completed; a row of the same case first, then any case. */
  const likeliest = (c: CodeCompletion | null | undefined, caret: number): { from: number; at: number; rest: string; item: CodeSuggestion } | null => {
    if (!c || !c.items.length) return null;
    const typed = input.value.slice(c.from, caret);
    if (!typed) return null;
    // matched by the name; the ghost shows what Tab writes after the typed letters (the name's rest when the row writes more, an import)
    const item = c.items.find((it) => it.label.startsWith(typed) && it.label !== typed) ?? c.items.find((it) => it.label.toLowerCase().startsWith(typed.toLowerCase()) && it.label.length > typed.length);
    if (!item) return null;
    const text = item.insert ?? item.label;
    return { from: c.from, at: caret, rest: (text.toLowerCase().startsWith(typed.toLowerCase()) ? text : item.label).slice(typed.length), item };
  };
  /** Tab on a ghost: the row is written (its case wins over what was typed), with its head line. */
  const takeGhost = (): void => {
    const g = ghost.peek();
    if (!g) return;
    ghost.set(null);
    const text = g.item.insert ?? g.item.label;
    input.setRangeText(text, g.from, g.at, "end");
    let caret = g.from + text.length - (g.item.back ?? 0);
    if (g.item.head && !input.value.includes(g.item.head)) { input.setRangeText(`${g.item.head}\n`, 0, 0, "preserve"); caret += g.item.head.length + 1; }
    input.setSelectionRange(caret, caret);
    set(input.value);
  };
  const close = (): void => { if (done.peek()) done.set(null); };
  const pick = (i: number): void => {
    const d = done.peek(), item = shown.peek()[i];
    if (!d || !item) return;
    const text = item.insert ?? item.label;
    input.setRangeText(text, d.from, d.to, "end");
    let caret = d.from + text.length - (item.back ?? 0);
    // the row's import, at the top, when the text does not have it
    if (item.head && !input.value.includes(item.head)) { input.setRangeText(`${item.head}\n`, 0, 0, "preserve"); caret += item.head.length + 1; }
    input.setSelectionRange(caret, caret);
    // `again`: the list stays open and takes the next rows (closing and opening it again would mount a second list)
    if (!item.again) done.set(null);
    set(input.value);
    if (item.again) ask(true);
  };
  /** The caret's place on screen: the same character in the coloured copy. */
  const caretRect = (): DOMRect | null => {
    const d = done.peek();
    let left = d ? d.from : input.selectionStart ?? 0;
    const walker = globalThis.document.createTreeWalker?.(code, 4 /* text */);
    if (!walker) return null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const len = n.nodeValue?.length ?? 0;
      if (left <= len) {
        const r = globalThis.document.createRange();
        r.setStart(n, left); r.setEnd(n, left);
        return r.getClientRects?.()[0] ?? r.getBoundingClientRect?.() ?? null;
      }
      left -= len;
    }
    return null;
  };

  // ---- the IDE keys: edits go through the browser's own undo (insertText) where it has it
  const on = (c: CodeCommand): boolean => props.keys !== false && (props.keys?.[c] ?? true) && (c !== "save" || !!props.onSave);
  const unit = (): string => " ".repeat(props.tabSize ?? 2);
  let editing = false;
  /** Replace [from, to) with `text`, then select [a, b] (offsets in the new text). */
  const replace = (from: number, to: number, text: string, a: number, b = a): void => {
    editing = true;
    input.focus();
    input.setSelectionRange(from, to);
    const doc = globalThis.document as Document & { execCommand?: (c: string, ui: boolean, v: string) => boolean };
    let ok = false;
    try { ok = !!doc.execCommand?.("insertText", false, text) && input.value.slice(from, from + text.length) === text; } catch { ok = false; }
    if (!ok) input.setRangeText(text, from, to, "end");
    editing = false;
    input.setSelectionRange(a, b);
    set(input.value);
  };
  /** The whole lines the selection touches: [start, end) without the last line's "\n". */
  const block = (): { start: number; end: number; s: number; e: number } => {
    const v = input.value, s = input.selectionStart ?? 0, e = input.selectionEnd ?? s;
    const last = e > s && v[e - 1] === "\n" ? e - 1 : e;
    const start = v.lastIndexOf("\n", s - 1) + 1, nl = v.indexOf("\n", last);
    return { start, end: nl < 0 ? v.length : nl, s, e };
  };
  const indent = (back: boolean): void => {
    const v = input.value, { start, end, s, e } = block(), u = unit();
    if (!back && !v.slice(s, e).includes("\n")) { replace(s, e, u, s + u.length); return; }
    const lines = v.slice(start, end).split("\n");
    let first = 0, total = 0;
    const out = lines.map((l, i) => {
      if (!back) { if (i === 0) first = u.length; total += u.length; return u + l; }
      const cut = /^\t/.test(l) ? 1 : (/^ */.exec(l)?.[0].length ?? 0) >= u.length ? u.length : (/^ */.exec(l)?.[0].length ?? 0);
      if (i === 0) first = -cut; total -= cut;
      return l.slice(cut);
    });
    const text = out.join("\n");
    replace(start, end, text, Math.max(start, s + first), Math.max(start, e + total));
  };
  const COMMENT: Record<string, string> = { js: "//", ts: "//", jsx: "//", tsx: "//", sh: "#" };
  const comment = (): boolean => {
    const mark = COMMENT[props.lang ?? "tsx"];
    if (!mark) return false;
    const v = input.value, { start, end, s, e } = block();
    const lines = v.slice(start, end).split("\n"), filled = lines.filter((l) => l.trim());
    const off = filled.length > 0 && filled.every((l) => l.trimStart().startsWith(mark));
    const pad = Math.min(...filled.map((l) => /^\s*/.exec(l)![0].length), 1e9);
    let first = 0, total = 0;
    const out = lines.map((l, i) => {
      if (!l.trim()) return l;
      if (off) { const at = l.indexOf(mark), n = mark.length + (l[at + mark.length] === " " ? 1 : 0); if (i === 0) first = -n; total -= n; return l.slice(0, at) + l.slice(at + n); }
      const at = pad === 1e9 ? 0 : pad; if (i === 0) first = mark.length + 1; total += mark.length + 1;
      return `${l.slice(0, at)}${mark} ${l.slice(at)}`;
    });
    replace(start, end, out.join("\n"), Math.max(start, s + first), Math.max(start, e + total));
    return true;
  };
  const moveLines = (up: boolean): void => {
    const v = input.value, { start, end, s, e } = block();
    if (up ? start === 0 : end >= v.length) return;
    const text = v.slice(start, end);
    if (up) { const p = v.lastIndexOf("\n", start - 2) + 1, prev = v.slice(p, start - 1); replace(p, end, `${text}\n${prev}`, s - (start - p), e - (start - p)); }
    else { const n = v.indexOf("\n", end + 1), stop = n < 0 ? v.length : n, next = v.slice(end + 1, stop); replace(start, stop, `${next}\n${text}`, s + next.length + 1, e + next.length + 1); }
  };
  const copyLines = (up: boolean): void => {
    const v = input.value, { start, end, s, e } = block(), text = v.slice(start, end);
    if (up) replace(end, end, `\n${text}`, s, e);
    else replace(end, end, `\n${text}`, s + text.length + 1, e + text.length + 1);
  };
  const deleteLines = (): void => {
    const v = input.value, { start, end } = block();
    const from = end < v.length ? start : Math.max(0, start - 1), to = end < v.length ? end + 1 : end;
    replace(from, to, "", Math.min(from === start ? start : from + 1, v.length - (to - from)));
  };
  const OPEN: Record<string, string> = { "{": "}", "(": ")", "[": "]" };
  const newline = (): void => {
    const v = input.value, s = input.selectionStart ?? 0, e = input.selectionEnd ?? s;
    const lineStart = v.lastIndexOf("\n", s - 1) + 1, pad = /^[ \t]*/.exec(v.slice(lineStart, s))![0];
    const before = v.slice(lineStart, s).trimEnd().slice(-1), after = v.slice(e).match(/^[ \t]*(.)/)?.[1];
    if (OPEN[before]) {
      const inner = `\n${pad}${unit()}`;
      replace(s, e, after === OPEN[before] ? `${inner}\n${pad}` : inner, s + inner.length);
      return;
    }
    replace(s, e, `\n${pad}`, s + pad.length + 1);
  };
  // Tab is the editor's until Escape: then Tab and Shift+Tab move the focus on (a keyboard way out)
  let free = false;
  const onKeyDown = (e: KeyboardEvent): void => {
    const mod = e.ctrlKey || e.metaKey;
    if (ghost.peek()) {
      if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); takeGhost(); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); ghost.set(null); return; }
      if (!mod && e.key.length > 1) ghost.set(null); // the caret moves: the ghost goes
    }
    if (mod && e.code === "Space" && on("suggest")) { e.preventDefault(); ask(true); return; }
    if (e.key === "F9" && props.onGutter) { e.preventDefault(); props.onGutter(input.value.slice(0, input.selectionStart ?? 0).split("\n").length, e); return; }
    if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "s" && on("save")) { e.preventDefault(); props.onSave!(input.value); return; }
    const d = done.peek();
    if (d) {
      // the arrows and Enter belong to the suggestion list (OptionList listens on this field); Tab picks too
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") return;
      if (e.key === "Tab") { e.preventDefault(); pick(active.peek()); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
    }
    if (e.key === "Escape" && on("release")) { free = true; return; }
    if (e.key === "Tab" && free) { free = false; return; }
    free = false;
    if (e.key === "Enter" && props.multiline === false) { e.preventDefault(); return; }
    if (ro() || e.isComposing) return;
    const multi = props.multiline !== false;
    if (e.key === "Tab" && !mod && !e.altKey && on(e.shiftKey ? "outdent" : "indent")) { e.preventDefault(); indent(e.shiftKey); return; }
    if (e.key === "Enter" && !mod && !e.shiftKey && !e.altKey && multi && on("newline")) { e.preventDefault(); newline(); return; }
    if (mod && !e.altKey && (e.key === "/" || e.code === "Slash") && on("comment")) { if (comment()) e.preventDefault(); return; }
    if (mod && e.shiftKey && e.key.toLowerCase() === "k" && multi && on("deleteLine")) { e.preventDefault(); deleteLines(); return; }
    if (e.altKey && !mod && (e.key === "ArrowUp" || e.key === "ArrowDown") && multi) {
      const up = e.key === "ArrowUp";
      if (e.shiftKey && on(up ? "copyUp" : "copyDown")) { e.preventDefault(); copyLines(up); return; }
      if (!e.shiftKey && on(up ? "moveUp" : "moveDown")) { e.preventDefault(); moveLines(up); return; }
    }
  };
  /** Every key, for the shortcuts menu (the ones turned off are left out). */
  const editorKeys = (): CodeShortcut[] => {
    const multi = props.multiline !== false, rows: [CodeCommand | "", string, () => string, boolean?][] = [
      ["indent", "Tab", () => t`Indent (or take the suggestion)`], ["outdent", "Shift+Tab", () => t`Outdent`],
      ["newline", "Enter", () => t`New line, keeping the indent`, multi], ["comment", "Ctrl+/", () => t`Comment / uncomment lines`, !!COMMENT[props.lang ?? "tsx"]],
      ["moveUp", "Alt+↑", () => t`Move lines up`, multi], ["moveDown", "Alt+↓", () => t`Move lines down`, multi],
      ["copyUp", "Shift+Alt+↑", () => t`Copy lines up`, multi], ["copyDown", "Shift+Alt+↓", () => t`Copy lines down`, multi],
      ["deleteLine", "Ctrl+Shift+K", () => t`Delete lines`, multi], ["suggest", "Ctrl+Space", () => t`Suggestions list`, !!props.complete],
      ["save", "Ctrl+S", () => t`Save`], ["", "F9", () => t`Toggle a breakpoint`, !!props.onGutter],
      ["", "Ctrl+Z / Ctrl+Y", () => t`Undo / redo`], ["release", "Esc, Tab", () => t`Leave the editor`],
    ];
    return rows.filter(([c, , , ok]) => ok !== false && (!c || on(c))).map(([, keys, label]) => ({ keys, label, group: () => t`Editor` }));
  };
  const input = h("textarea", {
    id: props.id ?? id, name: props.name, class: "m-ced-input", spellcheck: "false", autocapitalize: "off", autocomplete: "off", autocorrect: "off", rows: 1,
    readonly: () => !!props.readonly, disabled: () => !!props.disabled, "aria-label": () => val(props.label) ?? t`Code`,
    "aria-describedby": () => (props.message === false ? null : `${id}-msg`),
    onKeyDown,
    onInput: (e: Event) => { if (editing) return; ghost.set(null); set(input.value); const ie = e as InputEvent; ask(false, ie.inputType === "insertText" ? ie.data ?? "" : ""); },
    onClick: () => { close(); ghost.set(null); },
    onBlur: (e: FocusEvent) => { close(); ghost.set(null); props.onBlur?.(e); },
  }) as HTMLTextAreaElement;
  syncValue(input, get);
  props.inputRef?.(input);

  const anchor = virtualAnchor(caretRect, () => input);
  const open = computed(() => !!done());
  const list = h(Popover, {
    anchor: () => anchor, open: () => open(), onOpenChange: (o: boolean) => { if (!o) close(); }, role: null, flush: true, autoFocus: false, placement: "bottom-start", panelClass: "m-ced-list",
    children: (_close: unknown) => [h(OptionList<number>, {
      id: `${id}-list`, keysFrom: input, active, inline: true, check: false, size: "sm", label: () => val(props.suggestionsLabel) ?? t`Suggestions`, empty: false,
      options: () => shown().map((it, i) => ({ value: i, label: it.label, hint: it.hint, group: it.group })),
      onPick: (i: number) => { pick(i); input.focus(); },
    }), props.sources?.length ? () => (done()?.all ? null : sourceBar()) : null],
  });
  // the chips under the list; a press keeps the focus in the text (the list stays open)
  const sourceBar = (): unknown => h("div", { class: "m-ced-sources", role: "group", "aria-label": t`Suggestion source`, onPointerdown: (e: Event) => e.preventDefault() },
    (props.sources ?? []).map((s) => h(Chip, {
      size: "sm", selected: () => chosen() === s.value, children: s.label,
      onClick: () => { chosen.set(s.value); active.set(0); props.onSourceChange?.(s.value); },
    })),
    () => (done() && !shown().length ? h("span", { class: "m-ced-none" }, t`No suggestions here`) : null));

  // the gutter's press area, over the text field's start: the line under the pointer (its number's place)
  const lineAt = (y: number): number => {
    let n = 1;
    for (const el of code.querySelectorAll<HTMLElement>(".m-ced-ln")) { if (el.getBoundingClientRect().top <= y + 1) n = Number(el.dataset["line"]); else break; }
    return n;
  };
  let hover: Element | null = null;
  const unhover = (): void => { hover?.classList.remove("is-hover"); hover = null; };
  const hit = h("span", {
    class: "m-ced-gutter", "aria-hidden": "true",
    onPointerdown: (e: PointerEvent) => { if (e.button !== 0) return; e.preventDefault(); props.onGutter?.(lineAt(e.clientY), e); },
    onPointermove: (e: PointerEvent) => { const el = code.querySelector(`.m-ced-ln[data-line="${lineAt(e.clientY)}"]`); if (el !== hover) { unhover(); hover = el; el?.classList.add("is-hover"); } },
    onPointerleave: unhover,
  });
  // the lit line comes into view when it moves
  effect(() => { const a = gutter() ? lit() : null; if (a) queueMicrotask(() => code.querySelector?.(".m-ced-lit")?.scrollIntoView?.({ block: "nearest" })); });
  const status = (): "ok" | "error" | false => { const s = val(props.status); return s === undefined ? "ok" : s; };
  const hint = props.hint === false ? null : props.hint ?? null;
  // the shortcuts menu: the editor's keys, then the app's (grouped), each with its keys
  const keysLabel = (): string => val(props.shortcutsLabel) ?? t`Keyboard shortcuts`;
  const keyRow = (k: CodeShortcut): unknown => h("li", { class: "m-ced-key" },
    h("span", { class: "m-ced-key-what" }, () => val(k.label)),
    h("span", { class: "m-ced-key-keys" }, k.keys.split(/(\s+\/\s+|,\s*)/).map((part) => (/^(\s+\/\s+|,\s*)$/.test(part) ? h("span", { class: "m-ced-key-or" }, part.trim()) : part.split(/\+(?=.)/).map((key, i) => [i ? "+" : null, h(Kbd, {}, key)])))));
  const keysMenu = (): unknown => {
    const groups = new Map<string, CodeShortcut[]>();
    for (const k of [...editorKeys(), ...(val(props.moreShortcuts) ?? [])]) { const g = val(k.group) ?? ""; groups.set(g, [...(groups.get(g) ?? []), k]); }
    return h("div", { class: "m-ced-keys", role: "group", "aria-label": keysLabel },
      [...groups].map(([g, rows]) => h("section", { class: "m-ced-keys-group" }, g ? h("h4", { class: "m-ced-keys-head" }, g) : null, h("ul", { class: "m-ced-keys-list" }, rows.map(keyRow)))));
  };
  const keysButton = props.shortcuts === false ? null : h(Dropdown, { icon: commandIcon, label: keysLabel, variant: "ghost", size: "sm", placement: "top-end", class: "m-ced-keys-btn", panelClass: "m-ced-keys-panel", children: () => keysMenu() });
  const foot = props.message === false ? undefined : h("span", { class: () => cx("m-ced-msg", status() === "error" && "is-error"), id: `${id}-msg`, role: "status", "aria-live": "polite" },
    () => (status() === false ? null : h(StatusDot, { tone: untrack(status) === "error" ? "warn" : "success", size: "sm" })),
    h("span", { class: "m-ced-msg-text" }, () => val(props.message)));
  return h(EditorFrame, {
    class: () => cx("m-ced", gutter() && "is-gutter", val(props.class)), disabled: () => !!props.disabled, readonly: () => !!props.readonly,
    foot, showFoot: props.message !== false,
    footProps: { class: "m-ced-foot", divider: true, actions: [hint, keysButton, props.copy !== false && h(CopyButton, { text: get, iconOnly: true, class: "m-ced-copy", ...(props.copyLabel != null ? { label: props.copyLabel } : {}) })] },
    children: [h("div", { class: "m-ced-area" }, pre, input, () => (gutter() ? hit : null)), list] }) as Element;
}
