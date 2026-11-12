// Editors: ListEditor and KeyValueEditor moved to component folders (src/components/forms/list-editor, key-value-editor),
// JsonEditor and MarkdownEditor to src/components/composite/; these paths keep working. Markdown (the safe renderer) stays here.
import "./editors.css";
import { h } from "../dom/h.ts";
import { cx, type ClassProp } from "./util.ts";
export * from "../components/forms/list-editor/index.ts";
export * from "../components/forms/key-value-editor/index.ts";

// ------------------------------------------------------------------ JSON (moved to src/components/composite/json-editor/; these paths keep working)
export { JsonEditor, parseJson, type JsonEditorProps, type JsonParseResult, type JsonMode } from "../components/composite/json-editor/index.ts";

// ------------------------------------------------------------------ Markdown (the parser lives in the safe content core: dom/markdown.ts)
import { markdownNodes, type MarkdownOptions } from "../dom/markdown.ts";
export { markdownNodes, isSafeLink, type MarkdownOptions } from "../dom/markdown.ts";

export interface MarkdownProps extends MarkdownOptions {
  source?: string | null | undefined;
  /** A string child (when no `source`). */
  children?: unknown;
  class?: ClassProp;
}

/** Render Markdown safely. Props: source (or a string child), images (default true, https only), newTab (default true). */
export function Markdown(props: MarkdownProps): unknown {
  return h("div", { class: cx("hm-markdown", props.class) }, () => markdownNodes(props.source ?? props.children ?? "", { images: props.images, newTab: props.newTab, headingOffset: props.headingOffset }));
}

// MarkdownEditor moved to src/components/composite/markdown-editor/ (modular structure); this path keeps working.
export { MarkdownEditor, type MarkdownEditorProps, type MarkdownView, type MarkdownTool } from "../components/composite/markdown-editor/index.ts";
