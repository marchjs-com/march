// MarkdownEditor (hadi-march/ui, also hadi-march/forms): Markdown source with a live preview. Folder: src/components/composite/markdown-editor/.
//   <MarkdownEditor bind:value={$md} view="split" />
// Views: write, preview, split (resizable, scrolls in sync) and rich (the same value in a RichTextEditor, loaded on
// first use). The toolbar and shortcuts write Markdown syntax as native undo steps; Enter continues lists, Tab indents
// them; pasted HTML (web pages, office suites) becomes Markdown through the safe content core.
// Built from EditorFrame (border, focus ring, head and foot bars), FormatToolbar, the pill strip of Tabs (TabList)
// and Splitter.
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
import { EditorFrame } from "../editor-frame/index.ts";
import { markdownNodes } from "../../../dom/markdown.ts";
import { FormatToolbar, formatShortcut } from "../format-toolbar/index.ts";
import * as md from "./md-ops.ts";
import tr from "./tr.ts";

messages("tr", tr);

export type MarkdownView = "write" | "preview" | "split" | "rich";
export type MarkdownTool = "h2" | "h3" | "bold" | "italic" | "strike" | "code" | "link" | "ul" | "ol" | "task" | "quote" | "codeblock";

export interface MarkdownEditorProps extends ControlProps<string> {
  /** Height of the source in lines (default 10). @tr Kaynağın satır cinsinden yüksekliği (varsayılan 10). */
  rows?: number | undefined;
  /** Placeholder of the empty source. @tr Boş kaynağın yer tutucusu. */
  placeholder?: string | undefined;
  /** First view (default "write"; "split" when `preview="split"`). @tr İlk görünüm (varsayılan "write"; `preview="split"` iken "split"). */
  view?: MarkdownView | undefined;
  /** Views offered, in order (default write, preview, split, rich). One view hides the switcher. @tr Sırasıyla sunulan görünümler (varsayılan write, preview, split, rich). Tek görünüm seçiciyi gizler. */
  views?: readonly MarkdownView[] | undefined;
  /** Older form of `view`: "tab" (write / preview tabs) or "split". @tr `view`'ın eski biçimi: "tab" (yaz / önizle sekmeleri) ya da "split". */
  preview?: "tab" | "split" | undefined;
  /** Formatting toolbar over the source: true (default), false, or the tools to show in order ("|" is a separator). @tr Kaynağın üstündeki biçim araç çubuğu: true (varsayılan), false ya da sırasıyla gösterilecek araçlar ("|" ayırıcıdır). */
  toolbar?: boolean | readonly (MarkdownTool | "|")[] | undefined;
  /** Own icons for tools: an icon, a string or a node each. @tr Araçlar için kendi ikonların: her biri ikon, metin ya da düğüm. */
  icons?: Partial<Record<MarkdownTool, unknown>> | undefined;
  /** The Markdown syntax reminder at the end of the footer (default true). @tr Alt bilginin sonundaki Markdown söz dizimi hatırlatması (varsayılan true). */
  hint?: boolean | undefined;
  /**
   * Own texts; each falls back to the built-in one: the views (`write`, `preview`, `split`, `rich`), the switcher's
   * name (`view`), the toolbar's name (`formatting`), `tools` (a name per tool), `source`, `resize`, `hint`,
   * `words(count)` and `minutes(count)`.
   * @tr Kendi metinlerin; her biri yerleşik olana döner: görünümler (`write`, `preview`, `split`, `rich`), seçicinin adı (`view`), araç çubuğunun adı (`formatting`), `tools` (araç başına bir ad), `source`, `resize`, `hint`, `words(count)` ve `minutes(count)`.
   */
  labels?: {
    write?: string; preview?: string; split?: string; rich?: string; view?: string; formatting?: string; source?: string; resize?: string; hint?: string;
    tools?: Partial<Record<MarkdownTool, string>> | undefined;
    words?: ((count: number) => string) | undefined; minutes?: ((count: number) => string) | undefined;
  } | undefined;
  /** Source and preview scroll together in the split view (default true). @tr Bölünmüş görünümde kaynak ve önizleme birlikte kayar (varsayılan true). */
  syncScroll?: boolean | undefined;
  /** Words and reading time under the editor (default true). @tr Düzenleyicinin altında sözcük sayısı ve okuma süresi (varsayılan true). */
  stats?: boolean | undefined;
  /** Split share of the source pane, 0–1 (default .5). @tr Bölünmüş görünümde kaynak bölmesinin payı, 0–1 (varsayılan .5). */
  split?: number | undefined;
  /** Extra classes on the root element. @tr Kök öğeye eklenen ek sınıflar. */
  class?: ClassProp;
}

const TOOLS: readonly (MarkdownTool | "|")[] = ["h2", "h3", "|", "bold", "italic", "strike", "code", "link", "|", "ul", "ol", "task", "quote", "codeblock"];
// rich view: the RichTextEditor chunk loads the first time it is opened
const RichView = lazy(() => import("../rich-text-editor/index.ts").then((m) => ({ default: m.RichTextEditor })), { placeholder: "form" });

/** Markdown editor: `<MarkdownEditor bind:value={$md} view="split" />`. */
export function MarkdownEditor(props: MarkdownEditorProps): unknown {
  const [get, set] = model(props, "");
  const id = uid("m-mde");
  const views = (): readonly MarkdownView[] => props.views?.length ? props.views : ["write", "preview", "split", "rich"];
  const first = untrack(() => props.view ?? (props.preview === "split" ? "split" : views()[0] ?? "write"));
  const view = signal<MarkdownView>(views().includes(first) ? first : views()[0] ?? "write");
  const c = ctl(props);
  const ro = (): boolean => !!(props.readonly || props.disabled);
  let syncing = false;
  const L = (): NonNullable<MarkdownEditorProps["labels"]> => props.labels ?? {};

  const LABEL: Record<MarkdownView, () => string> = { write: () => L().write ?? t`Write`, preview: () => L().preview ?? t`Preview`, split: () => L().split ?? t`Split`, rich: () => L().rich ?? t`Rich text` };

  const area = h("textarea", {
    ...c, class: "m-input m-mde-source", rows: () => props.rows ?? 10, placeholder: () => props.placeholder ?? null, spellcheck: "true",
    readonly: () => !!props.readonly, "aria-multiline": "true", "aria-label": () => c["aria-label"]() ?? L().source ?? t`Markdown source`,
    onInput: (e: Event) => set((e.target as HTMLTextAreaElement).value),
    onKeyDown: (e: KeyboardEvent) => keydown(e),
    onPaste: (e: ClipboardEvent) => paste(e),
    onScroll: () => sync(area, preview),
  }) as HTMLTextAreaElement;
  syncValue(area, get);

  const preview = h("div", {
    id: `${id}-preview`, class: "m-markdown m-mde-preview", role: "region", tabindex: "0", "aria-label": () => L().preview ?? t`Preview`,
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
    variant: "pill", class: "m-mde-views", label: () => L().view ?? t`Editor view`, value: view, controls: `${id}-body`, tabId: (v: string) => `${id}-tab-${v}`,
    tabs: views().map((v) => ({ id: v, label: LABEL[v] })), tabProps: () => ({ class: "m-mde-view" }), onSelect: (v: string) => view.set(v as MarkdownView),
  }));
  const toolbar = () => (props.toolbar === false || view() === "preview" || view() === "rich" ? null : h(FormatToolbar<MarkdownTool>, {
    tools: Array.isArray(props.toolbar) ? props.toolbar as readonly (MarkdownTool | "|")[] : TOOLS, prefix: "m-mde", label: () => L().formatting,
    name: (tool: MarkdownTool) => L().tools?.[tool], icons: props.icons, disabled: ro, onTool: exec,
  }));
  const body = () => {
    const v = view();
    return untrack(() => {
      if (v === "write") return area;
      if (v === "preview") return preview;
      if (v === "split") return h(Splitter, { start: area, end: preview, initial: props.split ?? 0.5, min: 0.2, label: L().resize ?? t`Resize the panes`, class: "m-mde-split" });
      return h(RichView, { value: get(), onChange: (x: string) => set(x), readonly: live(() => props.readonly), disabled: live(() => props.disabled), rows: props.rows ?? 10, toolbar: undefined, counter: false });
    });
  };
  const counts = () => md.stats(get());
  return h(EditorFrame, {
    class: () => cx("m-mde", `is-${view()}`, val(props.class)), disabled: () => !!props.disabled, "data-m-color": c["data-m-color"],
    head: toolbar, actions: tabs, headProps: { class: "m-mde-head" }, showFoot: () => props.stats !== false, footProps: { divider: true, class: "m-mde-foot" },
    foot: [
      h("span", null, () => L().words?.(counts().words) ?? t`${counts().words} words`), h("span", { "aria-hidden": "true" }, "·"), h("span", null, () => L().minutes?.(counts().minutes) ?? t`${counts().minutes} min read`),
      () => (props.hint === false ? null : h("span", { class: "m-mde-hint" }, () => (view() === "rich" ? "" : L().hint ?? t`Markdown: **bold**, _italic_, # heading, - list`)))],
    children: h("div", { id: `${id}-body`, class: "m-mde-body", role: () => (views().length > 1 ? "tabpanel" : null), "aria-labelledby": () => (views().length > 1 ? `${id}-tab-${view()}` : null) }, body),
  });
}
