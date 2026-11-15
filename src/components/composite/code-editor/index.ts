// CodeEditor (hadi-march/ui): a small code field: the text is coloured as it is typed (the CodeView colours, so
// unfinished code too), a suggestion list opens at the caret (you supply `complete`; `jsxCompleter` is the ready one
// for a JSX tag: prop names, then values inside quotes), ranges can be marked (a short flash, an error underline) and
// a foot line says what the owner thinks of the code. It does not run or compile anything: the owner reads `value`.
// Built from EditorFrame (border, focus ring, foot bar), Popover + OptionList (the suggestions; the keys stay in the
// text), CopyButton, Kbd and StatusDot.
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
import { StatusDot } from "../../feedback/status-dot/index.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { withColor } from "../../../theme/colors.ts";

export { jsxCompleter, type JsxProp } from "./jsx.ts";

messages("tr", { "Code": "Kod", "Suggestions": "Öneriler", "suggestions": "öneriler", "Copy": "Kopyala" });

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
}
/** What `complete` returns: the rows and the range of the text they replace. */
export interface CodeCompletion { from: number; to?: number; items: readonly CodeSuggestion[] }
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
/** A marked range of the text: "flash" lights up once, "error" stays underlined. */
export interface CodeMark { from: number; to: number; kind?: "flash" | "error" }

export interface CodeEditorProps extends ControlProps<string> {
  /** Colours: js / ts / jsx / tsx (default "tsx"), css, html, json, sh; "" for none. */
  lang?: string | undefined;
  /** Suggestions for the caret's place: called after typing and on Ctrl + Space; null / no items: no list. */
  complete?: ((ctx: CodeCompleteContext) => CodeCompletion | null | undefined) | undefined;
  /** Marked ranges (reactive). */
  marks?: MaybeFn<readonly CodeMark[] | undefined>;
  /** The foot line: what the owner says about the code (a text or a node; reactive). `false`: no foot bar. */
  message?: MaybeFn<unknown>;
  /** The dot before the message: "ok" (default) or "error". `false`: no dot. */
  status?: MaybeFn<"ok" | "error" | false | undefined>;
  /** The shortcut hint at the end of the foot line (default: Ctrl Space + "suggestions" when `complete` is given); `false` hides it. */
  hint?: unknown;
  /** The copy button (default true). */
  copy?: boolean | undefined;
  /** Text of the copy button (default "Copy", translated). */
  copyLabel?: MaybeFn<string> | undefined;
  /** Accessible name of the text field (default "Code", translated). */
  label?: MaybeFn<string | undefined>;
  /** Accessible name of the suggestion list (default "Suggestions", translated). */
  suggestionsLabel?: MaybeFn<string | undefined>;
  /** Enter writes a new line (default true); false: one line of code, Enter does nothing. */
  multiline?: boolean | undefined;
  /** How a "flash" mark shows: "glow" (default) or "none" / false. */
  flash?: "glow" | "none" | false | undefined;
  /** Called when focus leaves the editor (the owner may tidy the code). */
  onBlur?: ((e: FocusEvent) => void) | undefined;
  /** The textarea (to focus it, to read the selection). */
  inputRef?: ((el: HTMLTextAreaElement) => void) | undefined;
  class?: ClassProp;
}

/** `<CodeEditor bind:value={$code} complete={jsxCompleter({ tag: "Button", props })} message={$note} />` */
export function CodeEditor(props: CodeEditorProps): Element {
  const [get, set] = model(props, "");
  const id = uid("m-ced");
  const ro = (): boolean => !!(props.readonly || props.disabled);
  const done = signal<{ from: number; to: number; items: readonly CodeSuggestion[] } | null>(null);
  const active = signal(0);
  const marks = (): readonly CodeMark[] => val(props.marks) ?? [];

  // ---- the coloured copy under the (transparent) text field: same text, same wrapping
  const seen = new Set<string>();
  const paint = (): unknown => {
    const src = get(), list = [...marks()].filter((m) => m.to > m.from).sort((a, b) => a.from - b.from);
    const out: unknown[] = [], now = new Set<string>();
    let at = 0;
    const push = (kind: string, text: string, mark: CodeMark | null): void => {
      const node = kind ? h("span", { class: `m-tok-${kind}` }, text) : text;
      if (!mark) { out.push(node); return; }
      const key = `${mark.kind ?? "flash"}:${mark.from}:${mark.to}:${src.slice(mark.from, mark.to)}`;
      const flash = (mark.kind ?? "flash") === "flash";
      const el = h("mark", { class: flash ? "m-ced-mark is-flash" : "m-ced-mark is-error" }, node, flash && props.flash !== "none" && props.flash !== false && !seen.has(key) ? h("i", { class: "m-ced-glow", "data-k": key }) : null);
      now.add(key);
      out.push(el);
    };
    for (const [kind, text] of tokenize(src, props.lang ?? "tsx")) {
      // a token is cut where a mark starts or ends
      let from = at;
      const end = at + text.length;
      while (from < end) {
        const m = list.find((x) => x.from < end && x.to > from) ?? null;
        const stop = m ? (m.from > from ? m.from : Math.min(m.to, end)) : end;
        push(kind, text.slice(from - at, stop - at), m && m.from <= from ? m : null);
        from = stop;
      }
      at = end;
    }
    seen.clear(); for (const k of now) seen.add(k);
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
    if (!props.complete || ro()) return;
    const caret = input.selectionStart ?? input.value.length;
    const c = props.complete({ value: input.value, caret, before: input.value.slice(0, caret), forced, typed });
    batch(() => { active.set(0); done.set(c && c.items.length ? { from: c.from, to: c.to ?? caret, items: c.items } : null); });
  };
  const close = (): void => { if (done.peek()) done.set(null); };
  const pick = (i: number): void => {
    const d = done.peek(), item = d?.items[i];
    if (!d || !item) return;
    const text = item.insert ?? item.label;
    input.setRangeText(text, d.from, d.to, "end");
    const caret = d.from + text.length - (item.back ?? 0);
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

  const onKeyDown = (e: KeyboardEvent): void => {
    if ((e.ctrlKey || e.metaKey) && e.code === "Space") { e.preventDefault(); ask(true); return; }
    const d = done.peek();
    if (d) {
      // the arrows and Enter belong to the suggestion list (OptionList listens on this field); Tab picks too
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") return;
      if (e.key === "Tab") { e.preventDefault(); pick(active.peek()); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
    }
    if (e.key === "Enter" && props.multiline === false) e.preventDefault();
  };
  const input = h("textarea", {
    id: props.id ?? id, name: props.name, class: "m-ced-input", spellcheck: "false", autocapitalize: "off", autocomplete: "off", autocorrect: "off", rows: 1,
    readonly: () => !!props.readonly, disabled: () => !!props.disabled, "aria-label": () => val(props.label) ?? t`Code`,
    "aria-describedby": () => (props.message === false ? null : `${id}-msg`),
    onKeyDown,
    onInput: (e: Event) => { set(input.value); const ie = e as InputEvent; ask(false, ie.inputType === "insertText" ? ie.data ?? "" : ""); },
    onClick: close,
    onBlur: (e: FocusEvent) => { close(); props.onBlur?.(e); },
  }) as HTMLTextAreaElement;
  syncValue(input, get);
  props.inputRef?.(input);

  const anchor = virtualAnchor(caretRect, () => input);
  const open = computed(() => !!done());
  const list = h(Popover, {
    anchor: () => anchor, open: () => open(), onOpenChange: (o: boolean) => { if (!o) close(); }, role: null, flush: true, autoFocus: false, placement: "bottom-start", panelClass: "m-ced-list",
    children: (_close: unknown) => h(OptionList<number>, {
      id: `${id}-list`, keysFrom: input, active, inline: true, check: false, size: "sm", label: () => val(props.suggestionsLabel) ?? t`Suggestions`, empty: false,
      options: () => (done()?.items ?? []).map((it, i) => ({ value: i, label: it.label, hint: it.hint })),
      onPick: (i: number) => { pick(i); input.focus(); },
    }),
  });

  const status = (): "ok" | "error" | false => { const s = val(props.status); return s === undefined ? "ok" : s; };
  const hint = props.hint === false ? null : props.hint ?? (props.complete ? h("span", { class: "m-ced-hint" }, h(Kbd, {}, "Ctrl"), h(Kbd, {}, "Space"), () => t`suggestions`) : null);
  const foot = props.message === false ? undefined : h("span", { class: () => cx("m-ced-msg", status() === "error" && "is-error"), id: `${id}-msg`, role: "status", "aria-live": "polite" },
    () => (status() === false ? null : h(StatusDot, { tone: untrack(status) === "error" ? "warn" : "success", size: "sm" })),
    h("span", { class: "m-ced-msg-text" }, () => val(props.message)));
  return h(EditorFrame, {
    class: () => cx("m-ced", val(props.class)), disabled: () => !!props.disabled, readonly: () => !!props.readonly,
    foot, showFoot: props.message !== false,
    footProps: { class: "m-ced-foot", divider: true, actions: [hint, props.copy !== false && h(CopyButton, { text: get, ...(props.copyLabel != null ? { label: props.copyLabel } : {}) })] },
    children: [h("div", { class: "m-ced-area" }, pre, input), list] }) as Element;
}
