import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "MarkdownEditor",
  status: "experimental",
  category: "composite",
  since: "0.1.0",
  summary: "Markdown source with live preview: write / preview / resizable split with synced scrolling / rich view, toolbar, list continuation, HTML paste → Markdown.",
  composedOf: ["EditorFrame", "FormatToolbar", "Splitter", "Tabs", "RichTextEditor"],
  behaviors: ["safe content core (dom/markdown)", "lazy (rich view)"],
  hubs: [],
  showcase: "/editors",
});
