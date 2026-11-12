// RichTextEditor (hadi-march/ui): contenteditable rich text with Markdown in / out. Folder: src/components/composite/rich-text-editor/.
//   <RichTextEditor bind:value={$md} mentions={people} placeholder="Write…" />
// Toolbar (paragraph / headings, bold, italic, strike, code, link, lists, quote, code block, undo / redo), @mentions and
// :emoji suggestions, Markdown shortcuts while typing ("# ", "- ", "1. ", "> ", "``` "), paste cleaned through the safe
// content core (dom/safe.ts: no HTML parser, allowlist only), its own undo history (managers/undo › undoHistory).
import "./rich-text-editor.css";
import "../../../ui/menu.css";
import { signal, effect, untrack, batch } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages, dir } from "../../../core/i18n.ts";
import { cx, uid, on, val, type ClassProp } from "../../../core/util.ts";
import { glyph } from "../../../ui/util.ts";
import { model, ctl, type ControlProps } from "../../../forms/util.ts";
import { Toolbar } from "../../../ui/stack.ts";
import { IconButton } from "../../../ui/button.ts";
import { Avatar } from "../../../ui/avatar.ts";
import { floating } from "../../../ui/popover.ts";
import { markdownNodes } from "../../../dom/markdown.ts";
import { toMarkdown } from "../../../dom/to-markdown.ts";
import { parseHtml, sanitizeNode, isSafeLink } from "../../../dom/sanitize.ts";
import { undoHistory, type UndoStack } from "../../../managers/undo/history.ts";
import { bold } from "../../../icons/glyphs/bold.ts";
import { italic } from "../../../icons/glyphs/italic.ts";
import { strikethrough } from "../../../icons/glyphs/strikethrough.ts";
import { code as codeIcon } from "../../../icons/glyphs/code.ts";
import { link as linkIcon } from "../../../icons/glyphs/link.ts";
import { list as listIcon } from "../../../icons/glyphs/list.ts";
import { listOrdered } from "../../../icons/glyphs/listOrdered.ts";
import { quote } from "../../../icons/glyphs/quote.ts";
import { pilcrow } from "../../../icons/glyphs/pilcrow.ts";
import { heading } from "../../../icons/glyphs/heading.ts";
import { terminal } from "../../../icons/glyphs/terminal.ts";
import { undo as undoIcon } from "../../../icons/glyphs/undo.ts";
import { redo as redoIcon } from "../../../icons/glyphs/redo.ts";
import { check } from "../../../icons/glyphs/check.ts";
import { trash } from "../../../icons/glyphs/trash.ts";
import * as ops from "./ops.ts";
import { EMOJI, type EmojiEntry } from "./emoji.ts";
import tr from "./tr.ts";

messages("tr", tr);

export type { EmojiEntry };
export type { BlockType, Mark } from "./ops.ts";

/** A person (or anything) to mention with @. */
export interface Mention { id: string; label: string; hint?: string; avatar?: string }
/** Toolbar items, in the order given. "|" draws a separator. */
export type ToolName = "paragraph" | "h2" | "h3" | "bold" | "italic" | "strike" | "code" | "link" | "ul" | "ol" | "quote" | "codeblock" | "undo" | "redo" | "|";
export const DEFAULT_TOOLS: readonly ToolName[] = ["paragraph", "h2", "h3", "|", "bold", "italic", "strike", "code", "link", "|", "ul", "ol", "quote", "codeblock", "|", "undo", "redo"];

/** What `api` hands out: drive the editor from outside (an AI assistant, a template picker …). */
export interface RichTextApi {
  focus(): void;
  /** Current content as Markdown. */
  markdown(): string;
  /** Replace the content (recorded as one undo step). */
  setMarkdown(md: string): void;
  /** Insert Markdown at the caret. */
  insert(md: string): void;
  exec(tool: Exclude<ToolName, "|">): void;
  undo(): void;
  redo(): void;
  history: UndoStack;
}

export interface RichTextEditorProps extends ControlProps<string> {
  placeholder?: string | undefined;
  /** Toolbar items (default DEFAULT_TOOLS); false hides the toolbar (shortcuts still work). */
  toolbar?: boolean | readonly ToolName[] | undefined;
  /** People for @mentions: a list, or a lookup (may be async) called with the typed query. */
  mentions?: readonly Mention[] | ((query: string) => readonly Mention[] | Promise<readonly Mention[]>) | undefined;
  /** :emoji suggestions (default true; a list replaces the built-in set). */
  emoji?: boolean | readonly EmojiEntry[] | undefined;
  /** Markdown shortcuts while typing (default true). */
  shortcuts?: boolean | undefined;
  /** Undo history to record into (default: the editor's own; pass undoStack() to share the app's). */
  history?: UndoStack | undefined;
  /** Minimum height of the writing area in lines (default 6). */
  rows?: number | undefined;
  /** Word / character counter under the text (default true). */
  counter?: boolean | undefined;
  /** Receives the editor API once mounted. */
  api?: ((api: RichTextApi) => void) | undefined;
  class?: ClassProp;
}

interface Suggest { kind: "@" | ":"; query: string; items: { id: string; label: string; hint?: string | undefined; avatar?: string | undefined; insert: string }[]; active: number }

const mod = (e: KeyboardEvent): boolean => e.ctrlKey || e.metaKey;
const fragOf = (nodes: readonly Node[]): DocumentFragment => { const f = globalThis.document.createDocumentFragment(); for (const n of nodes) f.appendChild(n); return f; };
/** Markdown → clean editor nodes (through the schema: the renderer's extras such as rel / target / checkboxes go away). */
const mdFragment = (md: string): DocumentFragment => sanitizeNode(fragOf(markdownNodes(md, { images: false, newTab: false })));
const looksLikeMarkdown = (s: string): boolean => /^(#{1,6} |> |[-*+] |\d+[.)] |```)|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)/m.test(s);
const WORD = /[\p{L}\p{N}_'’-]/u;

/** Rich text editor: `<RichTextEditor bind:value={$markdown} mentions={team} />`. The value is Markdown. */
export function RichTextEditor(props: RichTextEditorProps): unknown {
  const [get, set] = model<string>(props, "");
  const history = props.history ?? undoHistory();
  const id = uid("hm-rte");
  const marks = signal<Record<string, boolean>>({});
  const block = signal<ops.BlockType>("p");
  const isEmpty = signal(true);
  const stats = signal<[number, number]>([0, 0]);
  const sug = signal<Suggest | null>(null);
  const linkOpen = signal(false);
  const linkText = signal("");
  const ro = (): boolean => !!(props.readonly || props.disabled);
  const c = ctl(props);
  let last: string | null = null;
  let snap: ops.Snapshot = { nodes: [], sel: null };
  let lastSel: ops.Sel | null = null;
  let linkBtn: Element | undefined;
  let sugSeq = 0;

  const root = h("div", {
    id: c.id, class: () => cx("hm-rte-content", isEmpty() && "is-empty"), role: "textbox", "aria-multiline": "true",
    contenteditable: () => (ro() ? "false" : "true"), spellcheck: "true", translate: "no", tabindex: () => (props.disabled ? "-1" : "0"),
    "aria-label": () => c["aria-label"]() ?? t`Rich text editor`, "aria-describedby": c["aria-describedby"], "aria-invalid": c["aria-invalid"],
    "aria-readonly": () => (props.readonly ? "true" : null), "aria-disabled": () => (props.disabled ? "true" : null),
    "aria-placeholder": () => props.placeholder ?? null, "data-placeholder": () => props.placeholder ?? "",
    "aria-autocomplete": "list", "aria-haspopup": "listbox", "aria-expanded": () => String(!!sug()),
    "aria-controls": () => (sug() ? `${id}-sug` : null), "aria-activedescendant": () => (sug()?.items.length ? `${id}-sug-${sug()!.active}` : null),
    onKeyDown: (e: KeyboardEvent) => keydown(e), onBeforeInput: (e: InputEvent) => beforeInput(e), onInput: (e: InputEvent) => input(e),
    onPaste: (e: ClipboardEvent) => paste(e), onFocus: props.onFocus, onBlur: (e: FocusEvent) => { props.onBlur?.(e); },
    onMouseUp: () => refresh(), onKeyUp: () => refresh(),
  }) as HTMLElement;

  // ------------------------------------------------------------------ content ⇄ value
  const measure = (): void => {
    const text = ops.blocks(root).map((b) => b.textContent ?? "").join("\n").replace(/\u00a0/g, " ");
    batch(() => {
      isEmpty.set(!text.trim() && !root.querySelector("[data-mention],hr,li") && root.children.length <= 1 && ops.blockType(root.firstElementChild) === "p");
      stats.set([text.split(/\s+/).filter((w) => WORD.test(w)).length, text.length]);
    });
  };
  const emit = (): void => {
    measure();
    const md = toMarkdown(root);
    if (md !== last) { last = md; set(md); }
  };
  const load = (md: string): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    root.appendChild(mdFragment(md));
    ops.tidy(root);
    measure();
    snap = ops.snapshot(root, null);
  };
  effect(() => {
    const v = get() ?? "";
    if (v === last) return;
    last = v;
    untrack(() => load(v));
  });

  /** Record the change since the last snapshot as one undo step (typing merges by `merge`). */
  const record = (label: string, merge?: string): void => {
    const prev = snap;
    const next = ops.snapshot(root, ops.saveSel(root));
    snap = next;
    if (ops.sameContent(prev, root)) return;
    history.push({ label, undo: () => restore(prev), redo: () => restore(next), ...(merge ? { merge } : {}) });
    emit();
  };
  const restore = (s: ops.Snapshot): void => {
    const focused = globalThis.document?.activeElement === root;
    ops.applySnapshot(root, s, focused);
    snap = s;
    emit();
    refresh();
  };

  /** Run an edit on the current (or last known) selection, then record it. */
  const run = (label: string, fn: (s: ops.Sel) => ops.Sel | void): void => {
    if (ro()) return;
    const s = ops.saveSel(root) ?? lastSel ?? [1, 1];
    if (globalThis.document?.activeElement !== root) root.focus({ preventScroll: true });
    const out = fn(s) ?? s;
    ops.restoreSel(root, out);
    record(label);
    refresh();
  };

  // ------------------------------------------------------------------ toolbar state
  const refresh = (): void => {
    const s = ops.saveSel(root);
    if (!s) return;
    lastSel = s;
    const [n] = ops.pointOf(root, Math.min(...s));
    batch(() => {
      marks.set({ strong: ops.hasMark(root, s, "strong"), em: ops.hasMark(root, s, "em"), s: ops.hasMark(root, s, "s"), code: ops.hasMark(root, s, "code"), a: !!ops.linkAt(root, s) });
      block.set(ops.blockType(ops.blockOf(root, n)));
    });
  };
  on(globalThis.document, "selectionchange", () => { if (root.contains(globalThis.document.getSelection?.()?.anchorNode ?? null)) refresh(); });

  /** With a caret only, a mark applies to the word around it. */
  const wordSel = (s: ops.Sel): ops.Sel => {
    if (s[0] !== s[1]) return s;
    const [n, o] = ops.pointOf(root, s[0]);
    if (n.nodeType !== 3) return s;
    const text = n.nodeValue ?? "";
    let a = o, b = o;
    while (a > 0 && WORD.test(text[a - 1]!)) a--;
    while (b < text.length && WORD.test(text[b]!)) b++;
    return a === b ? s : [s[0] - (o - a), s[0] + (b - o)];
  };
  const LABEL: Record<Exclude<ToolName, "|">, () => string> = {
    paragraph: () => t`Paragraph`, h2: () => t`Heading 2`, h3: () => t`Heading 3`, bold: () => t`Bold`, italic: () => t`Italic`, strike: () => t`Strikethrough`,
    code: () => t`Inline code`, link: () => t`Link`, ul: () => t`Bulleted list`, ol: () => t`Numbered list`, quote: () => t`Quote`, codeblock: () => t`Code block`,
    undo: () => t`Undo`, redo: () => t`Redo`,
  };
  const MARK_OF: Partial<Record<ToolName, ops.Mark>> = { bold: "strong", italic: "em", strike: "s", code: "code" };
  const BLOCK_OF: Partial<Record<ToolName, ops.BlockType>> = { paragraph: "p", h2: "h2", h3: "h3", ul: "ul", ol: "ol", quote: "blockquote", codeblock: "pre" };
  const exec = (tool: Exclude<ToolName, "|">): void => {
    const m = MARK_OF[tool], b = BLOCK_OF[tool];
    if (m) run(LABEL[tool](), (s) => { const w = wordSel(s); ops.toggleMark(root, w, m); return s[0] === s[1] ? s : w; });
    else if (b) run(LABEL[tool](), (s) => { ops.setBlocks(root, ops.blocksBetween(root, s), b); return s; });
    else if (tool === "link") openLink();
    else if (tool === "undo") void history.undo();
    else if (tool === "redo") void history.redo();
  };

  // ------------------------------------------------------------------ links
  const openLink = (): void => {
    if (ro()) return;
    const s = ops.saveSel(root) ?? lastSel;
    lastSel = s;
    linkText.set(s ? ops.linkAt(root, s)?.getAttribute("href") ?? "" : "");
    linkOpen.set(true);
  };
  const closeLink = (refocus = true): void => { linkOpen.set(false); if (refocus) { root.focus({ preventScroll: true }); ops.restoreSel(root, lastSel); } };
  const applyLink = (): void => {
    const href = linkText.peek().trim();
    if (!href || !isSafeLink(href)) return;
    linkOpen.set(false);
    run(t`Link`, (s) => {
      const at = ops.linkAt(root, s);
      if (s[0] === s[1] && at) { at.setAttribute("href", href); return s; }
      if (s[0] === s[1]) {
        const w = wordSel(s);
        if (w[0] !== w[1]) { ops.toggleMark(root, w, "a", { href }, true); return [w[1], w[1]]; }
        const a = globalThis.document.createElement("a");
        a.setAttribute("href", href);
        a.textContent = href.replace(/^mailto:|^tel:/i, "");
        const end = ops.insertFragment(root, s, fragOf([a]));
        return end;
      }
      ops.toggleMark(root, s, "a", { href }, true);
      return s;
    });
  };
  const unlink = (): void => { linkOpen.set(false); run(t`Remove link`, (s) => { ops.removeLinks(root, s); return s; }); };

  // ------------------------------------------------------------------ suggestions (@mentions, :emoji)
  const emojiList = (): readonly EmojiEntry[] => (Array.isArray(props.emoji) ? (props.emoji as readonly EmojiEntry[]) : EMOJI);
  const fold = (s: string): string => s.toLocaleLowerCase(untrack(dir) === "rtl" ? undefined : "tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
  const updateSuggest = async (): Promise<void> => {
    const s = ops.saveSel(root);
    if (!s || s[0] !== s[1]) { sug.set(null); return; }
    const m = /(?:^|[\s(])([@:])([\p{L}\p{N}_.-]{0,24})$/u.exec(ops.textBefore(root, s).replace(/ /g, " "));
    if (!m) { sug.set(null); return; }
    const kind = m[1] as "@" | ":", query = m[2]!;
    const seq = ++sugSeq;
    let items: Suggest["items"] = [];
    if (kind === "@" && props.mentions) {
      const q = fold(query);
      const list = typeof props.mentions === "function" ? await props.mentions(query) : props.mentions.filter((p) => fold(`${p.label} ${p.hint ?? ""}`).includes(q));
      items = list.slice(0, 8).map((p) => ({ id: p.id, label: p.label, hint: p.hint, avatar: p.avatar, insert: p.label }));
    } else if (kind === ":" && props.emoji !== false && query.length >= 1) {
      const q = fold(query);
      items = emojiList().filter(([, name, kw]) => name.startsWith(q) || fold(kw).split(" ").some((w) => w.startsWith(q))).slice(0, 8).map(([e, name]) => ({ id: name, label: e, hint: `:${name}:`, insert: e }));
    } else { sug.set(null); return; }
    if (seq !== sugSeq) return;
    if (kind === ":" && !items.length) { sug.set(null); return; }
    sug.set({ kind, query, items, active: 0 });
  };
  const pick = (i: number): void => {
    const st = sug.peek();
    const item = st?.items[i];
    if (!st || !item) return;
    sug.set(null);
    run(st.kind === "@" ? t`Mention` : t`Emoji`, (s) => {
      const at = ops.deleteBefore(root, s, st.query.length + 1);
      const d = globalThis.document;
      let node: Node;
      if (st.kind === "@") { const span = d.createElement("span"); span.setAttribute("data-mention", item.id); span.setAttribute("contenteditable", "false"); span.textContent = `@${item.insert}`; node = span; }
      else node = d.createTextNode(item.insert);
      return ops.insertFragment(root, at, fragOf([node, d.createTextNode(" ")]));
    });
  };
  const caretAnchor = {
    getBoundingClientRect: (): DOMRect => {
      const r = globalThis.document.getSelection?.()?.rangeCount ? globalThis.document.getSelection()!.getRangeAt(0) : null;
      const rect = r?.getClientRects?.()[0] ?? r?.getBoundingClientRect?.();
      return rect && (rect.width || rect.height) ? rect : root.getBoundingClientRect();
    },
    contains: (n: Node | null) => root.contains(n),
    closest: (sel: string) => root.closest(sel),
  } as unknown as Element;

  // ------------------------------------------------------------------ input
  const keydown = (e: KeyboardEvent): void => {
    const st = sug.peek();
    if (st && st.items.length) {
      const n = st.items.length;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sug.set({ ...st, active: (st.active + (e.key === "ArrowDown" ? 1 : n - 1)) % n }); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(st.active); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); sug.set(null); return; }
    }
    if (mod(e) && !e.altKey) {
      const k = e.key.toLowerCase();
      const map: Record<string, Exclude<ToolName, "|">> = e.shiftKey ? { x: "strike", "7": "ol", "8": "ul", "9": "quote", z: "redo", "&": "ol", "*": "ul", "(": "quote" } : { b: "bold", i: "italic", e: "code", k: "link", z: "undo", y: "redo" };
      const tool = map[k] ?? (e.shiftKey ? map[e.code.replace(/^Digit/, "")] : undefined);
      if (tool) { e.preventDefault(); exec(tool); return; }
    }
    if (mod(e) && e.altKey && /^Digit[023]$/.test(e.code)) { e.preventDefault(); exec(e.code === "Digit0" ? "paragraph" : e.code === "Digit2" ? "h2" : "h3"); return; }
    if (e.key === "Backspace" && !mod(e) && !ro()) {
      const s = ops.saveSel(root);
      if (s && s[0] === s[1] && ops.textBefore(root, s) === "") {
        const b = ops.blockOf(root, ops.pointOf(root, s[0])[0]);
        if (b && ops.blockType(b) !== "p") { e.preventDefault(); run(t`Paragraph`, (x) => { ops.setBlocks(root, [b], "p"); return x; }); }
      }
    }
  };
  const beforeInput = (e: InputEvent): void => {
    if (ro()) return;
    const type = e.inputType;
    if (type === "historyUndo") { e.preventDefault(); exec("undo"); }
    else if (type === "historyRedo") { e.preventDefault(); exec("redo"); }
    else if (type === "formatBold") { e.preventDefault(); exec("bold"); }
    else if (type === "formatItalic") { e.preventDefault(); exec("italic"); }
    else if (type === "formatStrikeThrough") { e.preventDefault(); exec("strike"); }
    else if (type === "insertParagraph") { e.preventDefault(); if (sug.peek()?.items.length) return; run(t`New paragraph`, (s) => ops.splitBlock(root, s)); }
    else if (type === "insertLineBreak") {
      e.preventDefault();
      run(t`Line break`, (s) => {
        const d = globalThis.document, br = d.createElement("br");
        const at = ops.insertFragment(root, s, fragOf([br]));
        // a <br> at the very end of a block needs a second one to show the new line
        if (!br.nextSibling) br.after(d.createElement("br"));
        return at;
      });
    }
  };
  const BLOCK_RULE: Record<string, ops.BlockType> = { "#": "h2", "##": "h2", "###": "h3", "-": "ul", "*": "ul", "+": "ul", ">": "blockquote", "```": "pre" };
  const input = (e: InputEvent): void => {
    if (ro()) return;
    // foreign markup (drop, spellcheck replacements, browser quirks): back to the schema, caret kept
    if (ops.hasForeign(root)) {
      const s = ops.saveSel(root);
      ops.tidy(root);
      ops.restoreSel(root, s);
    }
    if (props.shortcuts !== false && e.inputType === "insertText" && (e.data === " " || e.data === " ")) {
      const s = ops.saveSel(root);
      const before = s ? ops.textBefore(root, s).replace(/ /g, " ") : "";
      const m = /^(#{1,3}|[-*+]|\d+[.)]|>|```) $/.exec(before);
      if (s && m) {
        const type = BLOCK_RULE[m[1]!] ?? "ol";
        const at = ops.deleteBefore(root, s, before.length);
        const b = ops.blockOf(root, ops.pointOf(root, at[0])[0]);
        if (b && ops.blockType(b) !== type) { ops.setBlocks(root, [b], type); ops.restoreSel(root, at); record(LABEL[type === "blockquote" ? "quote" : type === "pre" ? "codeblock" : type === "p" ? "paragraph" : type](), undefined); refresh(); return; }
        ops.restoreSel(root, s);
      }
    }
    record(t`Typing`, "typing");
    refresh();
    void updateSuggest();
  };
  const paste = (e: ClipboardEvent): void => {
    e.preventDefault();
    if (ro()) return;
    const html = e.clipboardData?.getData("text/html") ?? "";
    const text = e.clipboardData?.getData("text/plain") ?? "";
    const s = ops.saveSel(root);
    const inPre = !!s && ops.blockType(ops.blockOf(root, ops.pointOf(root, s[0])[0])) === "pre";
    const d = globalThis.document;
    let frag: DocumentFragment;
    if (inPre || (!html && !looksLikeMarkdown(text))) {
      const paras = text.replace(/\r\n?/g, "\n").split(/\n{2,}/);
      frag = inPre || paras.length < 2 ? fragOf(text.replace(/\r\n?/g, "\n").split("\n").flatMap((l, i) => (i ? [d.createElement("br"), d.createTextNode(l)] : [d.createTextNode(l)]))) : fragOf(paras.map((p) => { const el = d.createElement("p"); el.textContent = p.replace(/\n/g, " "); return el; }));
      if (inPre) frag = fragOf([d.createTextNode(text.replace(/\r\n?/g, "\n"))]);
    } else frag = html ? parseHtml(html) : mdFragment(text);
    run(t`Paste`, (x) => ops.insertFragment(root, x, frag));
  };

  // ------------------------------------------------------------------ view
  const tools = (): readonly ToolName[] => (props.toolbar === false ? [] : Array.isArray(props.toolbar) ? (props.toolbar as readonly ToolName[]) : DEFAULT_TOOLS);
  const ICON: Record<Exclude<ToolName, "|">, Parameters<typeof glyph>[0]> = { paragraph: pilcrow, h2: heading, h3: heading, bold, italic, strike: strikethrough, code: codeIcon, link: linkIcon, ul: listIcon, ol: listOrdered, quote, codeblock: terminal, undo: undoIcon, redo: redoIcon };
  const pressed = (tool: ToolName): boolean => {
    const m = MARK_OF[tool];
    if (m) return !!marks()[m];
    if (tool === "link") return !!marks().a;
    const b = BLOCK_OF[tool];
    return !!b && block() === b;
  };
  const toolButton = (tool: Exclude<ToolName, "|">, i: number): Element => {
    const toggle = tool !== "undo" && tool !== "redo" && tool !== "link";
    const btn = h(IconButton, {
      icon: glyph(ICON[tool]), label: LABEL[tool], size: "sm", class: () => cx("hm-rte-tool", pressed(tool) && "is-on", (tool === "h2" || tool === "h3") && `hm-rte-tool-${tool}`),
      "aria-pressed": toggle ? () => String(pressed(tool)) : null, "aria-keyshortcuts": KEYS[tool] ?? null, tabindex: i === 0 ? "0" : "-1",
      "aria-haspopup": tool === "link" ? "dialog" : null, "aria-expanded": tool === "link" ? () => String(linkOpen()) : null,
      disabled: () => ro() || (tool === "undo" && !history.canUndo()) || (tool === "redo" && !history.canRedo()),
      // keep the text selection: the button never takes focus on pointer down
      onMouseDown: (e: MouseEvent) => e.preventDefault(),
      onClick: () => exec(tool),
    }) as Element;
    if (tool === "link") linkBtn = btn;
    return btn;
  };
  const KEYS: Partial<Record<ToolName, string>> = { bold: "Control+B", italic: "Control+I", strike: "Control+Shift+X", code: "Control+E", link: "Control+K", ol: "Control+Shift+7", ul: "Control+Shift+8", quote: "Control+Shift+9", undo: "Control+Z", redo: "Control+Shift+Z", paragraph: "Control+Alt+0", h2: "Control+Alt+2", h3: "Control+Alt+3" };
  // toolbar: one tab stop, arrows move between buttons (mirrored in RTL)
  const toolbarKeys = (e: KeyboardEvent): void => {
    const btns = Array.from((e.currentTarget as Element).querySelectorAll<HTMLButtonElement>(".hm-rte-tool:not(:disabled)"));
    const i = btns.indexOf(globalThis.document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const fwd = untrack(dir) === "rtl" ? "ArrowLeft" : "ArrowRight", back = fwd === "ArrowRight" ? "ArrowLeft" : "ArrowRight";
    const j = e.key === fwd ? (i + 1) % btns.length : e.key === back ? (i - 1 + btns.length) % btns.length : e.key === "Home" ? 0 : e.key === "End" ? btns.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    for (const b of btns) b.tabIndex = -1;
    btns[j]!.tabIndex = 0;
    btns[j]!.focus();
  };
  const bar = () => {
    const list = tools();
    if (!list.length) return null;
    let n = 0;
    return h("div", { class: "hm-rte-bar", onKeyDown: toolbarKeys },
      h(Toolbar, { label: () => t`Formatting`, class: "hm-rte-toolbar", children: list.map((tool) => (tool === "|" ? h("span", { class: "hm-rte-sep", role: "separator", "aria-orientation": "vertical" }) : toolButton(tool, n++))) }));
  };

  // the link panel opens under the selected text (the toolbar may have scrolled away); without a selection, under the button
  const selAnchor = {
    getBoundingClientRect: (): DOMRect => {
      const r = lastSel ? ops.rangeOf(root, lastSel).getBoundingClientRect() : null;
      return r && (r.width || r.height) ? r : (linkBtn ?? root).getBoundingClientRect();
    },
    contains: (n: Node | null) => root.contains(n) || !!linkBtn?.contains(n),
    closest: (sel: string) => root.closest(sel),
  } as unknown as Element;
  const linkPanel = () => (linkOpen() ? floating({
    anchor: selAnchor, placement: "bottom-start", class: "hm-dropdown hm-rte-link", role: "dialog", attrs: { "aria-label": t`Link` },
    onClose: (refocus) => closeLink(!!refocus),
    children: [
      h("label", { class: "hm-rte-link-label", for: `${id}-href` }, () => t`Link address`),
      h("div", { class: "hm-rte-link-row" },
        h("input", {
          id: `${id}-href`, class: () => cx("hm-input hm-rte-link-input", linkText().trim() && !isSafeLink(linkText().trim()) && "is-invalid"), type: "url", inputmode: "url", autocomplete: "off", spellcheck: "false",
          placeholder: "https://", value: untrack(linkText), "aria-invalid": () => (linkText().trim() && !isSafeLink(linkText().trim()) ? "true" : null), "aria-describedby": `${id}-href-help`,
          ref: (el: HTMLInputElement) => queueMicrotask(() => { el.focus(); el.select(); }),
          onInput: (e: Event) => linkText.set((e.target as HTMLInputElement).value),
          onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } },
        }),
        h(IconButton, { icon: glyph(check), label: () => t`Apply`, size: "sm", class: "hm-rte-link-ok", disabled: () => !linkText().trim() || !isSafeLink(linkText().trim()), onClick: applyLink }),
        () => (marks().a ? h(IconButton, { icon: glyph(trash), label: () => t`Remove link`, size: "sm", variant: "danger", onClick: unlink }) : null)),
      h("p", { id: `${id}-href-help`, class: () => cx("hm-rte-link-help", linkText().trim() && !isSafeLink(linkText().trim()) && "is-error") }, () => t`Only http(s), mailto, tel and relative links`),
    ],
  }) : null);

  const suggestPanel = () => {
    const st = sug();
    if (!st) return null;
    return floating({
      anchor: caretAnchor, placement: "bottom-start", class: cx("hm-menu hm-rte-sug", st.kind === ":" && "hm-rte-sug-emoji"), role: "listbox", id: `${id}-sug`,
      attrs: { "aria-label": t`Suggestions` }, onClose: () => sug.set(null),
      children: st.items.length ? st.items.map((it, i) => h("div", {
        id: `${id}-sug-${i}`, role: "option", class: () => cx("hm-menu-item hm-rte-sug-item", sug()?.active === i && "is-active"), "aria-selected": () => String(sug()?.active === i),
        onMouseDown: (e: MouseEvent) => { e.preventDefault(); pick(i); }, onMouseMove: () => { const cur = sug.peek(); if (cur && cur.active !== i) sug.set({ ...cur, active: i }); },
      },
      st.kind === "@" ? h(Avatar, { name: it.label, src: it.avatar ?? null, size: "sm" }) : h("span", { class: "hm-rte-sug-emoji-glyph", "aria-hidden": "true" }, it.label),
      h("span", { class: "hm-rte-sug-label" }, st.kind === "@" ? it.label : it.hint),
      st.kind === "@" && it.hint ? h("span", { class: "hm-rte-sug-hint" }, it.hint) : null)) : h("div", { class: "hm-rte-sug-empty" }, () => t`No matches`),
    });
  };

  const api: RichTextApi = {
    focus: () => root.focus(),
    markdown: () => toMarkdown(root),
    setMarkdown: (md) => {
      const prev = snap;
      load(md);
      const next = snap;
      history.push({ label: t`Paste`, undo: () => restore(prev), redo: () => restore(next) });
      emit();
    },
    insert: (md) => run(t`Paste`, (s) => ops.insertFragment(root, s, mdFragment(md))),
    exec,
    undo: () => void history.undo(),
    redo: () => void history.redo(),
    history,
  };
  queueMicrotask(() => props.api?.(api));

  const rows = (): number => Math.max(2, props.rows ?? 6);
  return h("div", {
    class: () => cx("hm-rte", props.disabled && "is-disabled", props.readonly && "is-readonly", val(props.class)), "data-hm-color": c["data-hm-color"],
    style: () => ({ "--hm-rte-rows": String(rows()) }),
  },
  bar,
  root,
  () => (props.counter === false ? null : h("div", { class: "hm-rte-foot", "aria-live": "off" },
    h("span", { class: "hm-rte-hint" }, () => (props.mentions && props.emoji !== false ? t`Type @ to mention, : for emoji` : props.mentions ? t`Type @ to mention` : props.emoji !== false ? t`Type : for emoji` : "")),
    h("span", { class: "hm-rte-count" }, () => `${t`${stats()[0]} words`} · ${t`${stats()[1]} characters`}`))),
  linkPanel,
  suggestPanel);
}
