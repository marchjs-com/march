// RichTextEditor (hadi-march/ui): contenteditable rich text with Markdown in / out. Folder: src/components/composite/rich-text-editor/.
//   <RichTextEditor bind:value={$md} mentions={people} placeholder="Write…" />
// Toolbar (paragraph / headings, bold, italic, strike, code, link, lists, quote, code block, undo / redo), @mentions and
// :emoji suggestions, Markdown shortcuts while typing ("# ", "- ", "1. ", "> ", "``` "), paste cleaned through the safe
// content core (dom/safe.ts: no HTML parser, allowlist only), its own undo history (managers/undo › undoHistory).
// Built from EditorFrame (border, focus ring, head and foot bars), FormatToolbar, Popover + Field + TextInput (link
// panel) and Popover + OptionList (suggestions).
import "./rich-text-editor.css";
import { signal, computed, effect, untrack, batch } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages, dir } from "../../../core/i18n.ts";
import { cx, uid, on, val, type ClassProp } from "../../../core/util.ts";
import { fold } from "../../../core/text.ts";
import { glyph } from "../../../ui/util.ts";
import { isMod, undoKeys } from "../../../ui/keys.ts";
import { model, ctl, live, type ControlProps } from "../../../forms/util.ts";
import { Field } from "../../../forms/field.ts";
import { UrlInput } from "../../forms/text-input/index.ts";
import { OptionList } from "../../forms/option-list/index.ts";
import { IconButton } from "../../../ui/button.ts";
import { Avatar } from "../../../ui/avatar.ts";
import { EditorFrame } from "../editor-frame/index.ts";
import { Popover } from "../../overlays/popover/index.ts";
import { virtualAnchor } from "../../../ui/popover.ts";
import { markdownNodes } from "../../../dom/markdown.ts";
import { toMarkdown } from "../../../dom/to-markdown.ts";
import { parseHtml, sanitizeNode, normalizeBlocks, isSafeLink } from "../../../dom/sanitize.ts";
import { undoHistory, type UndoStack } from "../../../managers/undo/history.ts";
import { check } from "../../../icons/glyphs/check.ts";
import { trash } from "../../../icons/glyphs/trash.ts";
import { FormatToolbar, formatToolName, formatShortcut } from "../format-toolbar/index.ts";
import * as ops from "./ops.ts";
import { EMOJI, POPULAR_EMOJI, type EmojiEntry } from "./emoji.ts";
import tr from "./tr.ts";

messages("tr", tr);

export type { EmojiEntry };
export type { BlockType, Mark } from "./ops.ts";

/** A person (or anything) to mention with @. */
export interface Mention { id: string; label: string; hint?: string; avatar?: string }
/** Toolbar items, in the order given. "|" draws a separator. */
export type ToolName = "paragraph" | "h2" | "h3" | "bold" | "italic" | "strike" | "code" | "link" | "emoji" | "ul" | "ol" | "quote" | "codeblock" | "undo" | "redo" | "|";
/** Toolbar buttons RichTextEditor shows when `tools` is not given, in order. */
export const DEFAULT_TOOLS: readonly ToolName[] = ["paragraph", "h2", "h3", "|", "bold", "italic", "strike", "code", "link", "emoji", "|", "ul", "ol", "quote", "codeblock", "|", "undo", "redo"];

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
  /** Placeholder of the empty writing area. @tr Boş yazı alanının yer tutucusu. */
  placeholder?: string | undefined;
  /** Toolbar items (default DEFAULT_TOOLS); false hides the toolbar (shortcuts still work). @tr Araç çubuğu öğeleri (varsayılan DEFAULT_TOOLS); false araç çubuğunu gizler (kısayollar yine çalışır). */
  toolbar?: boolean | readonly ToolName[] | undefined;
  /** People to mention (after typing "@"): a list, or a lookup (may be async) called with the typed query. @tr Bahsedilecek kişiler ("@" yazınca): bir liste ya da yazılan sorguyla çağrılan bir arama (async olabilir). */
  mentions?: readonly Mention[] | ((query: string) => readonly Mention[] | Promise<readonly Mention[]>) | undefined;
  /** :emoji suggestions (default true; a list replaces the built-in set). @tr :emoji önerileri (varsayılan true; bir liste yerleşik kümenin yerini alır). */
  emoji?: boolean | readonly EmojiEntry[] | undefined;
  /** Markdown shortcuts while typing (default true). @tr Yazarken Markdown kısayolları (varsayılan true). */
  shortcuts?: boolean | undefined;
  /** Undo history to record into (default: the editor's own; pass undoStack() to share the app's). @tr Kaydedilecek geri alma geçmişi (varsayılan: düzenleyicinin kendi geçmişi; uygulamanınkini paylaşmak için undoStack() ver). */
  history?: UndoStack | undefined;
  /** Minimum height of the writing area in lines (default 6). @tr Yazı alanının satır cinsinden en küçük yüksekliği (varsayılan 6). */
  rows?: number | undefined;
  /** Word / character counter under the text (default true). @tr Metnin altındaki sözcük / karakter sayacı (varsayılan true). */
  counter?: boolean | undefined;
  /** Receives the editor API once mounted. @tr Takılınca düzenleyici API'sini alır. */
  api?: ((api: RichTextApi) => void) | undefined;
  /** The "Type @ to mention, : for emoji" hint under the text (default true; `counter={false}` removes the whole foot). @tr Metnin altındaki "Type @ to mention, : for emoji" ipucu (varsayılan true; `counter={false}` tüm alt kısmı kaldırır). */
  hint?: boolean | undefined;
  /** Own icon (any node or text) for a toolbar button: `{ bold: "B", link: <Icon of={chain} /> }`. @tr Bir araç çubuğu düğmesi için kendi ikonun (herhangi bir düğüm ya da metin): `{ bold: "B", link: <Icon of={chain} /> }`. */
  toolIcons?: Partial<Record<Exclude<ToolName, "|">, unknown>> | undefined;
  /** Own texts; defaults are the translated ones. `tools` names the toolbar buttons, `count` writes the counter. @tr Kendi metinlerin; varsayılanlar çevrilmiş olanlar. `tools` araç çubuğu düğmelerini adlandırır, `count` sayacı yazar. */
  labels?: {
    editor?: string; toolbar?: string; tools?: Partial<Record<Exclude<ToolName, "|">, string>>;
    link?: string; linkAddress?: string; linkHelp?: string; apply?: string; removeLink?: string;
    suggestions?: string; noMatches?: string; keepTyping?: string; hint?: string;
    count?: (words: number, characters: number) => string;
  } | undefined;
  /** Extra classes on the editor (`m-rte`). @tr Düzenleyiciye (`m-rte`) eklenen ek sınıflar. */
  class?: ClassProp;
}

interface Suggest { kind: "@" | ":"; query: string; button?: boolean; items: { id: string; label: string; hint?: string | undefined; avatar?: string | undefined; insert: string }[] }
type Tool = Exclude<ToolName, "|">;

const fragOf = (nodes: readonly Node[]): DocumentFragment => { const f = globalThis.document.createDocumentFragment(); for (const n of nodes) f.appendChild(n); return f; };
/** Markdown → clean editor nodes (through the schema: the renderer's extras such as rel / target / checkboxes go away). */
const mdFragment = (md: string): DocumentFragment => {
  const nodes = markdownNodes(md, { images: false, newTab: false });
  // task items keep their state as data-task (the checkbox input is not editor content)
  for (const n of nodes) for (const li of Array.from(n.querySelectorAll?.("li.m-task") ?? [])) {
    const box = li.querySelector("input");
    li.setAttribute("data-task", box && (box as HTMLInputElement).checked ? "x" : " ");
    box?.remove();
    if (li.firstChild?.nodeType === 3) (li.firstChild as Text).data = (li.firstChild as Text).data.replace(/^\s+/, "");
  }
  return sanitizeNode(fragOf(nodes));
};
const looksLikeMarkdown = (s: string): boolean => /^(#{1,6} |> |[-*+] |\d+[.)] |```)|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)/m.test(s);
const WORD = /[\p{L}\p{N}_'’-]/u;

/** HTML (a web page, an office suite, the clipboard) → Markdown, through the safe content core's allowlist. */
export function htmlToMarkdown(html: string): string {
  const holder = globalThis.document.createElement("div");
  holder.appendChild(parseHtml(html));
  return toMarkdown(normalizeBlocks(holder, { topHeading: 2 }));
}

/** Rich text editor: `<RichTextEditor bind:value={$markdown} mentions={team} />`. The value is Markdown. */
export function RichTextEditor(props: RichTextEditorProps): unknown {
  const [get, set] = model<string>(props, "");
  const history = props.history ?? undoHistory();
  const id = uid("m-rte");
  const marks = signal<Record<string, boolean>>({});
  const block = signal<ops.BlockType>("p");
  const isEmpty = signal(true);
  const stats = signal<[number, number]>([0, 0]);
  const sug = signal<Suggest | null>(null);
  // the highlighted suggestion (the list moves it: OptionList `keysFrom`)
  const sugActive = signal(0);
  const suggest = (s: Suggest): void => batch(() => { sugActive.set(0); sug.set(s); });
  const linkOpen = signal(false);
  const linkText = signal("");
  const ro = (): boolean => !!(props.readonly || props.disabled);
  const c = ctl(props);
  const L = (): NonNullable<RichTextEditorProps["labels"]> => props.labels ?? {};
  let last: string | null = null;
  let snap: ops.Snapshot = { nodes: [], sel: null };
  let lastSel: ops.Sel | null = null;
  let linkBtn: Element | undefined;
  let sugSeq = 0;

  const root = h("div", {
    id: c.id, class: () => cx("m-rte-content", isEmpty() && "is-empty"), role: "textbox", "aria-multiline": "true",
    contenteditable: () => (ro() ? "false" : "true"), spellcheck: "true", translate: "no", tabindex: () => (props.disabled ? "-1" : "0"),
    "aria-label": () => c["aria-label"]() ?? L().editor ?? t`Rich text editor`, "aria-describedby": c["aria-describedby"], "aria-invalid": c["aria-invalid"],
    "aria-readonly": () => (props.readonly ? "true" : null), "aria-disabled": () => (props.disabled ? "true" : null),
    "aria-placeholder": () => props.placeholder ?? null, "data-placeholder": () => props.placeholder ?? "",
    "aria-autocomplete": "list", "aria-haspopup": "listbox", "aria-expanded": () => String(!!sug()),
    "aria-controls": () => (sug() ? `${id}-sug` : null), "aria-activedescendant": () => (sug()?.items.length ? `${id}-sug-${sugActive()}` : null),
    onKeyDown: (e: KeyboardEvent) => keydown(e), onBeforeInput: (e: InputEvent) => beforeInput(e), onInput: (e: InputEvent) => input(e),
    onPaste: (e: ClipboardEvent) => paste(e), onFocus: props.onFocus, onBlur: (e: FocusEvent) => { props.onBlur?.(e); },
    onMouseUp: () => refresh(), onKeyUp: () => refresh(), onMouseDown: (e: MouseEvent) => taskClick(e),
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
  const MARK_OF: Partial<Record<ToolName, ops.Mark>> = { bold: "strong", italic: "em", strike: "s", code: "code" };
  const BLOCK_OF: Partial<Record<ToolName, ops.BlockType>> = { paragraph: "p", h2: "h2", h3: "h3", ul: "ul", ol: "ol", quote: "blockquote", codeblock: "pre" };
  const exec = (tool: Tool): void => {
    const m = MARK_OF[tool], b = BLOCK_OF[tool];
    if (m) run(formatToolName(tool), (s) => { const w = wordSel(s); ops.toggleMark(root, w, m); return s[0] === s[1] ? s : w; });
    else if (b) run(formatToolName(tool), (s) => { ops.setBlocks(root, ops.blocksBetween(root, s), b); return s; });
    else if (tool === "link") openLink();
    else if (tool === "emoji") openEmoji();
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
  // the toolbar's emoji button opens the same list as a typed ":" (the common ones), inserting at the caret
  const openEmoji = (): void => {
    if (ro()) return;
    root.focus({ preventScroll: true });
    if (!ops.saveSel(root)) ops.restoreSel(root, lastSel ?? [1, 1]);
    if (sug.peek()?.button) { sug.set(null); return; }
    suggest({ kind: ":", query: "", items: commonEmoji(), button: true });
  };
  const unlink = (): void => { linkOpen.set(false); run(t`Remove link`, (s) => { ops.removeLinks(root, s); return s; }); };

  // ------------------------------------------------------------------ suggestions (@mentions, :emoji)
  const emojiList = (): readonly EmojiEntry[] => (Array.isArray(props.emoji) ? (props.emoji as readonly EmojiEntry[]) : EMOJI);
  const commonEmoji = (): Suggest["items"] => {
    const list = emojiList(), common = Array.isArray(props.emoji) ? list.slice(0, 10) : POPULAR_EMOJI.map((n) => list.find((e) => e[1] === n)!).filter(Boolean);
    return common.map(([e, name]) => ({ id: name, label: e, hint: `:${name}:`, insert: e }));
  };
  const updateSuggest = async (): Promise<void> => {
    const s = ops.saveSel(root);
    if (!s || s[0] !== s[1]) { sug.set(null); return; }
    const m = ops.suggestTrigger(ops.textBefore(root, s));
    if (!m) { sug.set(null); return; }
    const { kind, query } = m;
    const seq = ++sugSeq;
    let items: Suggest["items"] = [];
    if (kind === "@" && props.mentions) {
      const q = fold(query);
      const list = typeof props.mentions === "function" ? await props.mentions(query) : props.mentions.filter((p) => fold(`${p.label} ${p.hint ?? ""}`).includes(q));
      items = list.slice(0, 8).map((p) => ({ id: p.id, label: p.label, hint: p.hint, avatar: p.avatar, insert: p.label }));
    } else if (kind === ":" && props.emoji !== false && !query) {
      // a lone ":" after a space or at a line start: the common ones at once; typing on filters them
      items = commonEmoji();
    } else if (kind === ":" && props.emoji !== false) {
      const q = fold(query);
      items = emojiList().filter(([, name, kw]) => name.startsWith(q) || fold(kw).split(" ").some((w) => w.startsWith(q))).slice(0, 8).map(([e, name]) => ({ id: name, label: e, hint: `:${name}:`, insert: e }));
    } else { sug.set(null); return; }
    if (seq !== sugSeq) return;
    if (kind === ":" && !items.length) { sug.set(null); return; }
    suggest({ kind, query, items });
  };
  const pick = (i: number): void => {
    const st = sug.peek();
    const item = st?.items[i];
    if (!st || !item) return;
    sug.set(null);
    run(st.kind === "@" ? t`Mention` : t`Emoji`, (s) => {
      const at = st.button ? s : ops.deleteBefore(root, s, st.query.length + 1);
      const d = globalThis.document;
      let node: Node;
      if (st.kind === "@") { const span = d.createElement("span"); span.setAttribute("data-mention", item.id); span.setAttribute("contenteditable", "false"); span.textContent = `@${item.insert}`; node = span; }
      else node = d.createTextNode(item.insert);
      return ops.insertFragment(root, at, fragOf([node, d.createTextNode(" ")]));
    });
  };
  const caretAnchor = virtualAnchor(() => {
    const r = globalThis.document.getSelection?.()?.rangeCount ? globalThis.document.getSelection()!.getRangeAt(0) : null;
    return r?.getClientRects?.()[0] ?? r?.getBoundingClientRect?.();
  }, () => root);

  // ------------------------------------------------------------------ task items: the box at the item's start toggles it
  const taskClick = (e: MouseEvent): void => {
    const li = (e.target as Element | null)?.closest?.("li[data-task]");
    if (!li || !root.contains(li) || ro()) return;
    const r = li.getBoundingClientRect();
    const from = untrack(dir) === "rtl" ? r.right - e.clientX : e.clientX - r.left;
    if (from > 22) return;
    e.preventDefault();
    run(t`Task`, (s) => { li.setAttribute("data-task", li.getAttribute("data-task") === "x" ? " " : "x"); return s; });
  };

  // ------------------------------------------------------------------ input
  const keydown = (e: KeyboardEvent): void => {
    const st = sug.peek();
    if (st && st.items.length) {
      // the arrows and Enter belong to the suggestion list (OptionList listens on this field); Tab picks too
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") return;
      if (e.key === "Tab") { e.preventDefault(); pick(sugActive.peek()); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); sug.set(null); return; }
    }
    if (undoKeys(e, history)) return;
    const tool = formatShortcut(e) as Tool | undefined;
    if (tool) { e.preventDefault(); exec(tool); return; }
    if (isMod(e) && e.altKey && /^Digit[023]$/.test(e.code)) { e.preventDefault(); exec(e.code === "Digit0" ? "paragraph" : e.code === "Digit2" ? "h2" : "h3"); return; }
    if (e.key === "Backspace" && !isMod(e) && !ro()) {
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
      // "[ ] " / "[x] " at the start of a list item makes it a task
      const task = /^\[([ xX]?)\] $/.exec(before);
      const li = s && task ? ops.blockOf(root, ops.pointOf(root, s[0])[0]) : null;
      if (s && task && li?.tagName === "LI") {
        const at = ops.deleteBefore(root, s, before.length);
        li.setAttribute("data-task", task[1]?.trim() ? "x" : " ");
        ops.restoreSel(root, at);
        record(t`Task`);
        return;
      }
      const m = /^(#{1,3}|[-*+]|\d+[.)]|>|```) $/.exec(before);
      if (s && m) {
        const type = BLOCK_RULE[m[1]!] ?? "ol";
        const at = ops.deleteBefore(root, s, before.length);
        const b = ops.blockOf(root, ops.pointOf(root, at[0])[0]);
        if (b && ops.blockType(b) !== type) { ops.setBlocks(root, [b], type); ops.restoreSel(root, at); record(formatToolName(type === "blockquote" ? "quote" : type === "pre" ? "codeblock" : type === "p" ? "paragraph" : type), undefined); refresh(); return; }
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
  const tools = (): readonly ToolName[] => (props.toolbar === false ? [] : Array.isArray(props.toolbar) ? (props.toolbar as readonly ToolName[]) : DEFAULT_TOOLS).filter((x) => x !== "emoji" || props.emoji !== false);
  // toggle tools: the format at the caret is "on"
  const toggles: Partial<Record<Tool, () => boolean>> = {};
  for (const [tool, m] of Object.entries(MARK_OF)) toggles[tool as Tool] = () => !!marks()[m];
  for (const [tool, b] of Object.entries(BLOCK_OF)) toggles[tool as Tool] = () => block() === b;
  const KEYS: Partial<Record<Tool, string>> = { undo: "Control+Z", redo: "Control+Shift+Z", paragraph: "Control+Alt+0", h2: "Control+Alt+2", h3: "Control+Alt+3" };
  const toolAttrs = (tool: Tool): Record<string, unknown> => (tool === "link" ? { class: () => !!marks().a && "is-pressed", "aria-haspopup": "dialog", "aria-expanded": () => String(linkOpen()), ref: (el: Element) => { linkBtn = el; } }
    : tool === "emoji" ? { "aria-haspopup": "listbox", "aria-expanded": () => String(!!sug()?.button) } : {});
  const bar = () => {
    const list = tools();
    return !list.length ? null : h(FormatToolbar<Tool>, {
      tools: list, prefix: "m-rte", label: () => L().toolbar, name: (tool: Tool) => L().tools?.[tool], icons: props.toolIcons, onTool: exec, pressed: toggles, keys: KEYS, attrs: toolAttrs,
      disabled: (tool: Tool) => ro() || (tool === "undo" && !history.canUndo()) || (tool === "redo" && !history.canRedo()),
    });
  };

  // the link panel opens under the selected text (the toolbar may have scrolled away); without a selection, under the button
  const selAnchor = virtualAnchor(() => (lastSel ? ops.rangeOf(root, lastSel).getBoundingClientRect() : null), () => root, () => linkBtn);
  const badLink = (): boolean => { const v = linkText().trim(); return !!v && !isSafeLink(v); };
  const linkHelp = (): string => L().linkHelp ?? t`Only http(s), mailto, tel and relative links`;
  const hrefId = `${id}-href`;
  const linkPanel = h(Popover, {
    anchor: () => selAnchor, open: linkOpen, label: () => L().link ?? t`Link`, panelClass: "m-rte-link", autoFocus: false,
    // Escape returns to the text with its selection; a press outside leaves focus where it went
    onOpenChange: (open: boolean, why: string) => { if (!open && why === "escape") { root.focus({ preventScroll: true }); ops.restoreSel(root, lastSel); } },
    children: (_close: unknown) => h(Field, { id: hrefId, label: live(() => L().linkAddress ?? t`Link address`), help: live(() => (badLink() ? null : linkHelp())), error: live(() => (badLink() ? linkHelp() : null)) },
      h("div", { class: "m-rte-link-row" },
        h(UrlInput, {
          id: hrefId, value: linkText, class: "m-rte-link-input", autocomplete: "off", spellcheck: "false", invalid: live(badLink), describedby: live(() => `${hrefId}-${badLink() ? "error" : "help"}`),
          ref: (el: HTMLInputElement) => queueMicrotask(() => { el.focus(); el.select?.(); }),
          onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } },
        }),
        h(IconButton, { icon: glyph(check), label: () => L().apply ?? t`Apply`, size: "sm", class: "m-rte-link-ok", disabled: () => !linkText().trim() || badLink(), onClick: applyLink }),
        () => (marks().a ? h(IconButton, { icon: glyph(trash), label: () => L().removeLink ?? t`Remove link`, size: "sm", variant: "danger", onClick: unlink }) : null))),
  });

  // suggestions: a list under the caret; the keys stay in the text (OptionList `keysFrom`)
  const sugOpen = computed(() => !!sug());
  const suggestPanel = h(Popover, {
    anchor: () => caretAnchor, open: () => sugOpen(), onOpenChange: (open: boolean) => { if (!open) sug.set(null); }, role: null, flush: true, autoFocus: false, panelClass: "m-rte-sug",
    children: (_close: unknown) => [
      h(OptionList<number>, {
        id: `${id}-sug`, keysFrom: root, active: sugActive, inline: true, check: false, label: () => L().suggestions ?? t`Suggestions`, class: () => sug()?.kind === ":" && "m-rte-sug-emoji",
        options: () => { const st = sug(); return (st?.items ?? []).map((it, i) => (st!.kind === "@" ? { value: i, label: it.label, hint: it.hint, icon: h(Avatar, { name: it.label, src: it.avatar ?? null, size: "sm" }) } : { value: i, label: it.hint, icon: it.label })); },
        empty: () => L().noMatches ?? t`No matches`, onPick: (i: number) => pick(i),
      }),
      () => { const st = sug(); return st && st.kind === ":" && !st.query && !st.button && st.items.length ? h("div", { class: "m-rte-sug-more", "aria-hidden": "true" }, () => L().keepTyping ?? t`Keep typing to search`) : null; },
    ],
  });

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
  return h(EditorFrame, {
    class: () => cx("m-rte", val(props.class)), disabled: () => !!props.disabled, readonly: () => !!props.readonly, "data-m-color": c["data-m-color"],
    style: () => ({ "--m-rte-rows": String(rows()) }),
    head: bar, showHead: () => tools().length > 0, headProps: { sticky: true, class: "m-rte-bar" },
    showFoot: () => props.counter !== false, footProps: { class: "m-rte-foot", "aria-live": "off" },
    foot: [
      h("span", { class: "m-rte-hint" }, () => (props.hint === false ? "" : L().hint != null ? L().hint : props.mentions && props.emoji !== false ? t`Type @ to mention, : for emoji` : props.mentions ? t`Type @ to mention` : props.emoji !== false ? t`Type : for emoji` : "")),
      h("span", { class: "m-rte-count" }, () => L().count?.(stats()[0], stats()[1]) ?? `${t`${stats()[0]} words`} · ${t`${stats()[1]} characters`}`)],
    children: [root, linkPanel, suggestPanel],
  });
}
