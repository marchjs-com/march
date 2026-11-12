import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "JsonEditor",
  status: "experimental",
  category: "composite",
  since: "0.1.0",
  summary: "JSON as text (parse errors with line / column, Format) or as a tree (TreeEditor, loaded on first use); one schema checks both views.",
  composedOf: ["TreeEditor"],
  behaviors: ["lazy (tree view)", "json-path (schema subset)"],
  hubs: [],
  showcase: "/editors",
});
