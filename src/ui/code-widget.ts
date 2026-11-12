// The "code-view" widget point: every Code tab draws `<Widget sources={[codeView]} input={…} />`.
// Defaults: CodeViewer (read-only, coloured), and two actions — Copy and Fullscreen. A live editor is added later by
// `codeView.provide({ id: "editor", render: (input, ctx) => … })`; it replaces CodeViewer everywhere at once.
import { h } from "../dom/h.ts";
import { signal } from "../core/reactive.ts";
import { t } from "../core/i18n.ts";
import { widgetPoint, Widget, type WidgetContext, type WidgetProvider } from "../widget/index.ts";
import { CodeView } from "./code-view.ts";
import { CopyButton } from "./button.ts";
import { openDialog } from "./dialog.ts";

/** One file of a multi-file example. */
export interface CodeFile { name: string; source: string; lang?: string }
/** Input of the code-view point. */
export interface CodeViewInput {
  source: string;
  lang: string;
  files?: readonly CodeFile[];
  /** Live editors call this with the edited source (the demo re-runs it). */
  apply?(src: string): void;
  /** Back to the original source. */
  reset?(): void;
  readOnly?: boolean;
  /** Set when drawn inside the fullscreen dialog (the Fullscreen action hides itself). */
  expanded?: boolean;
}

/** Default main provider: read-only, coloured, file switcher for multi-file examples. */
export function CodeViewer(input: CodeViewInput, ctx?: WidgetContext<CodeViewInput>): Element {
  const files: CodeFile[] = [{ name: "", source: input.source, lang: input.lang }, ...(input.files ?? [])];
  const current = signal(0);
  const file = (): CodeFile => files[current()] ?? files[0]!;
  const switcher = files.length > 1 && h("div", { class: "hm-code-files", role: "group", "aria-label": () => t`Files` },
    files.map((f, i) => h("button", {
      type: "button", class: "hm-btn hm-btn-ghost hm-btn-sm", "aria-pressed": () => String(current() === i), onClick: () => current.set(i),
    }, f.name || t`Example`)));
  return h("div", { class: input.expanded ? "hm-code-widget is-expanded" : "hm-code-widget" },
    () => { const f = file(); return h(CodeView, { code: f.source, lang: f.lang ?? input.lang, copy: false, tools: [switcher, ctx?.actions()] }); });
}

const viewer: WidgetProvider<CodeViewInput> = { id: "viewer", render: (input, ctx) => CodeViewer(input, ctx) };
const copy: WidgetProvider<CodeViewInput> = { id: "copy", slot: "action", order: 10, render: (input) => h(CopyButton, { text: input.source }) };
const fullscreen: WidgetProvider<CodeViewInput> = {
  id: "fullscreen", slot: "action", order: 20, when: (input) => !input.expanded,
  render: (input) => h("button", {
    type: "button", class: "hm-btn hm-btn-ghost hm-btn-sm", "aria-haspopup": "dialog",
    onClick: () => { void openDialog(() => h(Widget<CodeViewInput>, { sources: [codeView], input: { ...input, expanded: true } }), { size: "full", title: input.lang.toUpperCase(), class: "hm-code-full" }); },
  }, () => t`Fullscreen`),
};

/** The Code tab's widget point. */
export const codeView = widgetPoint<CodeViewInput>("code-view", { defaults: [viewer, copy, fullscreen] });
