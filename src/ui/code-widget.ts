// The "code-view" widget point: every Code tab draws `<Widget sources={[codeView]} input={…} />`.
// Defaults: CodeViewer (read-only, coloured), and two actions — Copy and Fullscreen. A live editor is added later by
// `codeView.provide({ id: "editor", render: (input, ctx) => … })`; it replaces CodeViewer everywhere at once.
import { h } from "../dom/h.ts";
import { signal } from "../core/reactive.ts";
import { t } from "../core/i18n.ts";
import { widgetPoint, Widget, type WidgetContext, type WidgetProvider } from "../widget/index.ts";
import { CodeView } from "./code-view.ts";
import { CopyButton, Button } from "./button.ts";
import { openDialog } from "../components/overlays/dialog/index.ts";

/** One file of a multi-file example. */
export interface CodeFile { name: string; source: string; lang?: string }
/** Input of the code-view point. */
export interface CodeViewInput {
  /** The code to show (the main file). @tr Gösterilecek kod (ana dosya). */
  source: string;
  /** Language for highlighting (e.g. "tsx", "css"). @tr Renklendirme dili (ör. "tsx", "css"). */
  lang: string;
  /** More files of a multi-file example; a file switcher appears. @tr Çok dosyalı bir örneğin diğer dosyaları; bir dosya seçici görünür. */
  files?: readonly CodeFile[];
  /** Live editors call this with the edited source (the demo re-runs it). @tr Canlı editörler bunu düzenlenen kaynakla çağırır (demo yeniden çalışır). */
  apply?(src: string): void;
  /** Back to the original source. @tr Özgün kaynağa geri döner. */
  reset?(): void;
  /** Asks a live editor not to allow edits. @tr Canlı editörden düzenlemeye izin vermemesini ister. */
  readOnly?: boolean;
  /** Set when drawn inside the fullscreen dialog (the Fullscreen action hides itself). @tr Tam ekran diyaloğunun içinde çizilirken verilir (Tam ekran eylemi kendini gizler). */
  expanded?: boolean;
}

/** Default main provider: read-only, coloured, file switcher for multi-file examples. */
export function CodeViewer(input: CodeViewInput, ctx?: WidgetContext<CodeViewInput>): Element {
  const files: CodeFile[] = [{ name: "", source: input.source, lang: input.lang }, ...(input.files ?? [])];
  const current = signal(0);
  const file = (): CodeFile => files[current()] ?? files[0]!;
  const switcher = files.length > 1 && h("div", { class: "m-code-files", role: "group", "aria-label": () => t`Files` },
    files.map((f, i) => h(Button, { variant: "ghost", size: "sm", pressed: () => current() === i, onClick: () => current.set(i) }, f.name || t`Example`)));
  return h("div", { class: input.expanded ? "m-code-widget is-expanded" : "m-code-widget" },
    () => { const f = file(); return h(CodeView, { code: f.source, lang: f.lang ?? input.lang, copy: false, tools: [switcher, ctx?.actions()] }); });
}

const viewer: WidgetProvider<CodeViewInput> = { id: "viewer", render: (input, ctx) => CodeViewer(input, ctx) };
const copy: WidgetProvider<CodeViewInput> = { id: "copy", slot: "action", order: 10, render: (input) => h(CopyButton, { text: input.source }) };
const fullscreen: WidgetProvider<CodeViewInput> = {
  id: "fullscreen", slot: "action", order: 20, when: (input) => !input.expanded,
  render: (input) => h(Button, {
    variant: "ghost", size: "sm", "aria-haspopup": "dialog",
    onClick: () => { void openDialog(() => h(Widget<CodeViewInput>, { sources: [codeView], input: { ...input, expanded: true } }), { size: "full", title: input.lang.toUpperCase(), class: "m-code-full" }); },
  }, () => t`Fullscreen`),
};

/** The Code tab's widget point. */
export const codeView = widgetPoint<CodeViewInput>("code-view", { defaults: [viewer, copy, fullscreen] });
