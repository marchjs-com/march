import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "UndoRedo",
  status: "experimental",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "The undo / redo button pair of an editor (IconButtons): fed by an undo stack or four props; the tooltip names the step and the shortcut.",
  category: "actions",
  composedOf: ["IconButton"],
  behaviors: [],
  hubs: [],
  showcase: "/buttons",
});
