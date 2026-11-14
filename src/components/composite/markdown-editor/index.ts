// MarkdownEditor (hadi-march/ui, also hadi-march/forms): Markdown source with a live preview. Folder: src/components/composite/markdown-editor/.
//   <MarkdownEditor bind:value={$md} view="split" />
// Views: write, preview, split (resizable, scrolls in sync) and rich (the same value in a RichTextEditor, loaded on
// first use). The toolbar and shortcuts write Markdown syntax as native undo steps; Enter continues lists, Tab indents
// them; pasted HTML (web pages, office suites) becomes Markdown through the safe content core.
// Built from the pill strip of Tabs (TabList), PanelHeader (head, foot), Splitter and the formatting toolbar shared with
// RichTextEditor (editor-parts/format-toolbar.ts: Toolbar + IconButton + Divider).
import "./markdown-editor.css";
import "../../../forms/editors.css";
import "../../../ui/field.css";
import { signal, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { lazy } from "../../../dom/lazy.ts";
import { t, messages } from "../../../core/i18n.ts";
import { cx, uid, val, type ClassProp } from "../../../core/util.ts";
import { isMod } from "../../../ui/keys.ts";
import { model, ctl, live, syncValue, type ControlProps } from "../../../forms/util.ts";
import { TabList } from "../../../ui/tabs.ts";
import { Splitter } from "../../../ui/splitter.ts";
import { PanelHeader } from "../../layout/panel-header/index.ts";
import { markdownNodes } from "../../../dom/markdown.ts";
import "../../../ui/editor-parts/frame.css";
import { FormatToolbar, formatShortcut } from "../../../ui/editor-parts/format-toolbar.ts";
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
  /** Formatting toolbar over the source: true (default), false, or the tools to show in order ("|" is a separator). */
  toolbar?: boolean | readonly (MarkdownTool | "|")[] | undefined;
  /** Own icons for tools: an icon, a string or a node each. */
  icons?: Partial<Record<MarkdownTool, unknown>> | undefined;
  /** The Markdown syntax reminder at the end of the footer (default true). */
  hint?: boolean | undefined;
  /**
   * Own texts; each falls back to the built-in one: the views (`write`, `preview`, `split`, `rich`), the switcher's
   * name (`view`), the toolbar's name (`formatting`), `tools` (a name per tool), `source`, `resize`, `hint`,
   * `words(count)` and `minutes(count)`.
   */
  labels?: {
    write?: string; preview?: string; split?: string; rich?: string; view?: string; formatting?: string; source?: string; resize?: string; hint?: string;
    tools?: Partial<Record<MarkdownTool, string>> | undefined;
    words?: ((count: number) => string) | undefined; minutes?: ((count: number) => string) | undefined;
  } | undefined;
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
  const L = (): NonNullable<MarkdownEditorProps["labels"]> => props.labels ?? {};

  const LABEL: Record<MarkdownView, () => string> = { write: () => L().write ?? t`Write`, preview: () => L().preview ?? t`Preview`, split: () => L().split ?? t`Split`, rich: () => L().rich ?? t`Rich text` };

  const area = h("textarea", {
    ...c, class: "hm-input hm-mde-source", rows: () => props.rows ?? 10, placeholder: () => props.placeholder ?? null, spellcheck: "true",
    readonly: () => !!props.readonly, "aria-multiline": "true", "aria-label": () => c["aria-label"]() ?? L().source ?? t`Markdown source`,
    onInput: (e: Event) => set((e.target as HTMLTextAreaElement).value),
    onKeyDown: (e: KeyboardEvent) => keydown(e),
    onPaste: (e: ClipboardEvent) => paste(e),
    onScroll: () => sync(area, preview),
  }) as HTMLTextAreaElement;
  syncValue(area, get);

  const preview = h("div", {
    id: `${id}-preview`, class: "hm-markdown hm-mde-preview", role: "region", tabindex: "0", "aria-label": () => L().preview ?? t`Preview`,
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
    if (isMod(e) && !e.altKey) {
      const tool = formatShortcut(e) as MarkdownTool | undefined;
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

  // the view switcher: the pill tab strip
  const tabs = () => (views().length < 2 ? null : h(TabList, {
    variant: "pill", class: "hm-mde-views", label: () => L().view ?? t`Editor view`, value: view, controls: `${id}-body`, tabId: (v: string) => `${id}-tab-${v}`,
    tabs: views().map((v) => ({ id: v, label: LABEL[v] })), tabProps: () => ({ class: "hm-mde-view" }), onSelect: (v: string) => view.set(v as MarkdownView),
  }));
  const toolbar = () => (props.toolbar === false || view() === "preview" || view() === "rich" ? null : h(FormatToolbar<MarkdownTool>, {
    tools: Array.isArray(props.toolbar) ? props.toolbar as readonly (MarkdownTool | "|")[] : TOOLS, prefix: "hm-mde", label: () => L().formatting ?? t`Formatting`,
    name: (tool: MarkdownTool) => L().tools?.[tool], icons: props.icons, disabled: ro, onTool: exec,
  }));
  const body = () => {
    const v = view();
    return untrack(() => {
      if (v === "write") return area;
      if (v === "preview") return preview;
      if (v === "split") return h(Splitter, { start: area, end: preview, initial: props.split ?? 0.5, min: 0.2, label: L().resize ?? t`Resize the panes`, class: "hm-mde-split" });
      return h(RichView, { value: get(), onChange: (x: string) => set(x), readonly: live(() => props.readonly), disabled: live(() => props.disabled), rows: props.rows ?? 10, toolbar: undefined, counter: false });
    });
  };
  const counts = () => md.stats(get());
  return h("div", { class: () => cx("hm-editor-frame hm-mde", `is-${view()}`, props.disabled && "is-disabled", val(props.class)), "data-hm-color": c["data-hm-color"] },
    h(PanelHeader, { as: "div", size: "sm", tone: "muted", divider: true, class: "hm-editor-head hm-mde-head", children: toolbar, actions: tabs }),
    h("div", { id: `${id}-body`, class: "hm-mde-body", role: () => (views().length > 1 ? "tabpanel" : null), "aria-labelledby": () => (views().length > 1 ? `${id}-tab-${view()}` : null) }, body),
    () => (props.stats === false ? null : h(PanelHeader, { as: "footer", size: "sm", divider: true, class: "hm-editor-foot hm-mde-foot", children: [
      h("span", null, () => L().words?.(counts().words) ?? t`${counts().words} words`), h("span", { "aria-hidden": "true" }, "·"), h("span", null, () => L().minutes?.(counts().minutes) ?? t`${counts().minutes} min read`),
      () => (props.hint === false ? null : h("span", { class: "hm-mde-hint" }, () => (view() === "rich" ? "" : L().hint ?? t`Markdown: **bold**, _italic_, # heading, - list`)))] })));
}
