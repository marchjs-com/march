import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Dialog",
  status: "stable",
  since: "0.1.0",
  summary: "Modal dialog: declarative <Dialog open> or openDialog() / openDrawer() returning a promise, plus confirm, prompt and askReason; focus trap, Escape, stacking.",
  category: "overlays",
  composedOf: ["Portal"],
  behaviors: ["focus trap", "layer stack"],
  hubs: [],
  showcase: "/overlays",
});
