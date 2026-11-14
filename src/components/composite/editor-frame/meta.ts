import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "EditorFrame",
  status: "experimental",
  since: "0.1.0",
  summary: "The frame of an editor: border and focus ring around a head bar (toolbar, search, tabs), the editing area and a foot bar (counts, hints); each bar optional, colour and states yours.",
  category: "composite",
  composedOf: ["PanelHeader"],
  behaviors: [],
  hubs: [],
  showcase: "/editors",
});
