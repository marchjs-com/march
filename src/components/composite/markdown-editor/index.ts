// MarkdownEditor (hadi-march/ui, also hadi-march/forms): Markdown source with a live preview. Folder: src/components/composite/markdown-editor/.
//   <MarkdownEditor bind:value={$md} view="split" />
// Views: write, preview, split (resizable, scrolls in sync) and rich (the same value in a RichTextEditor, loaded on
// first use). The toolbar and shortcuts write Markdown syntax as native undo steps; Enter continues lists, Tab indents
// them; pasted HTML (web pages, office suites) becomes Markdown through the safe content core.
import "./markdown-editor.css";
import "../../../forms/editors.css";
import "../../../ui/field.css";
import { signal, untrack, reactive } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { lazy } from "../../../dom/lazy.ts";
import { t, messages, dir } from "../../../core/i18n.ts";
import { cx, uid, val, type ClassProp } from "../../../core/util.ts";
import { glyph } from "../../../ui/util.ts";
import { model, ctl, syncValue, type ControlProps } from "../../../forms/util.ts";
import { Toolbar } from "../../../ui/stack.ts";
import { IconButton } from "../../../ui/button.ts";
import { Splitter } from "../../../ui/splitter.ts";
import { markdownNodes } from "../../../dom/markdown.ts";
import { bold } from "../../../icons/glyphs/bold.ts";
import { italic } from "../../../icons/glyphs/italic.ts";
import { strikethrough } from "../../../icons/glyphs/strikethrough.ts";
import { code as codeIcon } from "../../../icons/glyphs/code.ts";
import { link as linkIcon } from "../../../icons/glyphs/link.ts";
import { list as listIcon } from "../../../icons/glyphs/list.ts";
import { listOrdered } from "../../../icons/glyphs/listOrdered.ts";
import { checkCircle } from "../../../icons/glyphs/checkCircle.ts";
import { quote } from "../../../icons/glyphs/quote.ts";
import { heading } from "../../../icons/glyphs/heading.ts";
import { terminal } from "../../../icons/glyphs/terminal.ts";
import * as md from "./md-ops.ts";
import tr from "./tr.ts";

messages("tr", tr);

export type MarkdownView = "write" | "preview" | "split" | "rich";
export type MarkdownTool = "h2" | "h3" | "bold" | "italic" | "strike" | "code" | "link" | "ul" | "ol" | "task" | "quote" | "codeblock";

export interface MarkdownEditorProps extends ControlProps<string> {
  rows?: number | undefined;
  placeholder?: string | undefined;
  /** First view (default "write"; "split" when `preview="split"`). */
  view?: MarkdownView | undefined;
  /** Views offered, in order (default write, preview, split, rich). One view hides the switcher. */
  views?: readonly MarkdownView[] | undefined;
  /** Older form of `view`: "tab" (write / preview tabs) or "split". */
  preview?: "tab" | "split" | undefined;
  /** Formatting toolbar over the source (default true). */
  toolbar?: boolean | undefined;
  /** Source and preview scroll together in the split view (default true). */
  syncScroll?: boolean | undefined;
  /** Words and reading time under the editor (default true). */
  stats?: boolean | undefined;
  /** Split share of the source pane, 0–1 (default .5). */
  split?: number | undefined;
  class?: ClassProp;
}

const TOOLS: readonly (MarkdownTool | "|")[] = ["h2", "h3", "|", "bold", "italic", "strike", "code", "link", "|", "ul", "ol", "task", "quote", "codeblock"];
// rich view: the RichTextEditor chunk loads the first time it is opened
const RichView = lazy(() => import("../rich-text-editor/index.ts").then((m) => ({ default: m.RichTextEditor })), { placeholder: "form" });

/** Markdown editor: `<MarkdownEditor bind:value={$md} view="split" />`. */
export function MarkdownEditor(props: MarkdownEditorProps): unknown {
  const [get, set] = model(props, "");
  const id = uid("hm-mde");
  const views = (): readonly MarkdownView[] => props.views?.length ? props.views : ["write", "preview", "split", "rich"];
  const first = untrack(() => props.view ?? (props.preview === "split" ? "split" : views()[0] ?? "write"));
  const view = signal<MarkdownView>(views().includes(first) ? first : views()[0] ?? "write");
  const c = ctl(props);
  const ro = (): boolean => !!(props.readonly || props.disabled);
  let syncing = false;

  const LABEL: Record<MarkdownView, () => string> = { write: () => t`Write`, preview: () => t`Preview`, split: () => t`Split`, rich: () => t`Rich text` };
  const TOOL_LABEL: Record<MarkdownTool, () => string> = {
    h2: () => t`Heading 2`, h3: () => t`Heading 3`, bold: () => t`Bold`, italic: () => t`Italic`, strike: () => t`Strikethrough`, code: () => t`Inline code`,
    link: () => t`Link`, ul: () => t`Bulleted list`, ol: () => t`Numbered list`, task: () => t`Task list`, quote: () => t`Quote`, codeblock: () => t`Code block`,
  };
  const ICON: Record<MarkdownTool, Parameters<typeof glyph>[0]> = { h2: heading, h3: heading, bold, italic, strike: strikethrough, code: codeIcon, link: linkIcon, ul: listIcon, ol: listOrdered, task: checkCircle, quote, codeblock: terminal };

  const area = h("textarea", {
    ...c, class: "hm-input hm-mde-source", rows: () => props.rows ?? 10, placeholder: () => props.placeholder ?? null, spellcheck: "true",
    readonly: () => !!props.readonly, "aria-multiline": "true", "aria-label": () => c["aria-label"]() ?? t`Markdown source`,
    onInput: (e: Event) => set((e.target as HTMLTextAreaElement).value),
    onKeyDown: (e: KeyboardEvent) => keydown(e),
    onPaste: (e: ClipboardEvent) => paste(e),
    onScroll: () => sync(area, preview),
  }) as HTMLTextAreaElement;
  syncValue(area, get);

  const preview = h("div", {
    id: `${id}-preview`, class: "hm-markdown hm-mde-preview", role: "region", tabindex: "0", "aria-label": () => t`Preview`,
    onScroll: () => sync(preview, area),
  }, () => markdownNodes(get())) as HTMLElement;

  /** Apply an edit as one native undo step (execCommand keeps the textarea's undo stack; setRangeText where it is missing). */
  const apply = (r: md.Edit | null): boolean => {
    if (!r || ro()) return false;
    const old = area.value;
    let p = 0;
    while (p < old.length && p < r.text.length && old[p] === r.text[p]) p++;
    let q = 0;
    while (q < old.length - p && q < r.text.length - p && old[old.length - 1 - q] === r.text[r.text.length - 1 - q]) q++;
    area.focus({ preventScroll: true });
    area.setSelectionRange(p, old.length - q);
    const ins = r.text.slice(p, r.text.length - q);
    const doc = globalThis.document as Document & { execCommand?: (c: string, ui: boolean, v: string) => boolean };
    const ok = ins ? doc.execCommand?.("insertText", false, ins) : doc.execCommand?.("delete", false, "");
    if (!ok || area.value !== r.text) { area.setRangeText(ins, p, old.length - q, "end"); }
    area.setSelectionRange(r.start, r.end);
    set(area.value);
    return true;
  };
  const sel = (): [number, number] => [area.selectionStart ?? 0, area.selectionEnd ?? 0];
  const exec = (tool: MarkdownTool): void => {
    const [a, b] = sel(), v = area.value;
    const map: Record<MarkdownTool, () => md.Edit> = {
      bold: () => md.toggleWrap(v, a, b, "**"), italic: () => md.toggleWrap(v, a, b, "_"), strike: () => md.toggleWrap(v, a, b, "~~"), code: () => md.toggleWrap(v, a, b, "`"),
      link: () => md.insertLink(v, a, b), h2: () => md.toggleLines(v, a, b, "h2"), h3: () => md.toggleLines(v, a, b, "h3"), ul: () => md.toggleLines(v, a, b, "ul"),
      ol: () => md.toggleLines(v, a, b, "ol"), task: () => md.toggleLines(v, a, b, "task"), quote: () => md.toggleLines(v, a, b, "quote"), codeblock: () => md.codeBlock(v, a, b),
    };
    apply(map[tool]());
  };
  const keydown = (e: KeyboardEvent): void => {
    const [a, b] = sel(), v = area.value;
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      const tool: MarkdownTool | undefined = e.shiftKey ? ({ x: "strike", "7": "ol", "8": "ul", "9": "quote" } as Record<string, MarkdownTool>)[k] ?? ({ Digit7: "ol", Digit8: "ul", Digit9: "quote" } as Record<string, MarkdownTool>)[e.code] : ({ b: "bold", i: "italic", e: "code", k: "link" } as Record<string, MarkdownTool>)[k];
      if (tool) { e.preventDefault(); exec(tool); }
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { if (apply(md.continueList(v, a, b))) e.preventDefault(); return; }
    if (e.key === "Tab" && !e.altKey) { if (apply(md.indentLines(v, a, b, e.shiftKey))) e.preventDefault(); }
  };
  // pasted HTML → Markdown (the converter rides with the rich view's chunk, loaded on the first rich paste)
  const paste = (e: ClipboardEvent): void => {
    const html = e.clipboardData?.getData("text/html");
    if (!html || ro() || /^\s*<meta[^>]*>\s*<(pre|code)\b/i.test(html)) return;
    e.preventDefault();
    const [a, b] = sel();
    const text = e.clipboardData?.getData("text/plain") ?? "";
    void import("../rich-text-editor/index.ts").then((m) => {
      const v = area.value;
      let out = m.htmlToMarkdown(html) || text;
      // blocks start on their own line and leave one empty line after them
      if (out.includes("\n") || /^(#|>|- |\d+\. |```)/.test(out)) {
        if (a > 0 && v[a - 1] !== "\n") out = `\n\n${out}`;
        else if (a > 1 && v[a - 2] !== "\n") out = `\n${out}`;
        if (b < v.length && v[b] !== "\n") out = `${out}\n\n`;
      }
      apply({ text: v.slice(0, a) + out + v.slice(b), start: a + out.length, end: a + out.length });
    });
  };
  // keep the other pane at the same relative position
  const sync = (from: HTMLElement, to: HTMLElement): void => {
    if (syncing || props.syncScroll === false || view.peek() !== "split") return;
    const max = from.scrollHeight - from.clientHeight;
    syncing = true;
    to.scrollTop = max > 0 ? (from.scrollTop / max) * (to.scrollHeight - to.clientHeight) : 0;
    queueMicrotask(() => { syncing = false; });
  };

  const tabs = () => {
    const list = views();
    if (list.length < 2) return null;
    const pick = (v: MarkdownView, focus = false): void => { view.set(v); if (focus) globalThis.document?.getElementById(`${id}-tab-${v}`)?.focus(); };
    return h("div", { role: "tablist", class: "hm-mde-views", "aria-label": () => t`Editor view` }, list.map((v) => h("button", {
      type: "button", role: "tab", id: `${id}-tab-${v}`, class: "hm-mde-view", "aria-selected": () => String(view() === v), "aria-controls": `${id}-body`,
      tabindex: () => (view() === v ? "0" : "-1"), onClick: () => pick(v),
      onKeyDown: (e: KeyboardEvent) => {
        const i = list.indexOf(view.peek()), fwd = untrack(dir) === "rtl" ? "ArrowLeft" : "ArrowRight", back = fwd === "ArrowRight" ? "ArrowLeft" : "ArrowRight";
        const j = e.key === fwd ? (i + 1) % list.length : e.key === back ? (i - 1 + list.length) % list.length : e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : -1;
        if (j >= 0) { e.preventDefault(); pick(list[j]!, true); }
      },
    }, () => LABEL[v]())));
  };
  const toolbar = () => (props.toolbar === false || view() === "preview" || view() === "rich" ? null : h(Toolbar, {
    label: () => t`Formatting`, class: "hm-mde-toolbar",
    children: TOOLS.map((tool) => (tool === "|" ? h("span", { class: "hm-mde-sep", role: "separator", "aria-orientation": "vertical" }) : h(IconButton, {
      icon: glyph(ICON[tool]), label: TOOL_LABEL[tool], size: "sm", class: cx("hm-mde-tool", (tool === "h2" || tool === "h3") && `hm-mde-tool-${tool}`), disabled: ro,
      onMouseDown: (e: MouseEvent) => e.preventDefault(), onClick: () => exec(tool),
    }))),
  }));
  const body = () => {
    const v = view();
    return untrack(() => {
      if (v === "write") return area;
      if (v === "preview") return preview;
      if (v === "split") return h(Splitter, { start: area, end: preview, initial: props.split ?? 0.5, min: 0.2, label: t`Resize the panes`, class: "hm-mde-split" });
      return h(RichView, { value: get(), onChange: (x: string) => set(x), readonly: reactive(() => props.readonly), disabled: reactive(() => props.disabled), rows: props.rows ?? 10, toolbar: undefined, counter: false });
    });
  };
  const counts = () => md.stats(get());
  return h("div", { class: () => cx("hm-mde", `is-${view()}`, props.disabled && "is-disabled", val(props.class)), "data-hm-color": c["data-hm-color"] },
    h("div", { class: "hm-mde-head" }, toolbar, tabs),
    h("div", { id: `${id}-body`, class: "hm-mde-body", role: () => (views().length > 1 ? "tabpanel" : null), "aria-labelledby": () => (views().length > 1 ? `${id}-tab-${view()}` : null) }, body),
    () => (props.stats === false ? null : h("div", { class: "hm-mde-foot" },
      h("span", null, () => t`${counts().words} words`), h("span", { "aria-hidden": "true" }, "·"), h("span", null, () => t`${counts().minutes} min read`),
      h("span", { class: "hm-mde-hint" }, () => (view() === "rich" ? "" : t`Markdown: **bold**, _italic_, # heading, - list`)))));
}
