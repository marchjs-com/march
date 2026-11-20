import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Media",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "An image, video or audio element that fits its container (kind from the extension), a text fallback when loading fails; openMedia() shows it in a dialog.",
  category: "media",
  composedOf: ["Dialog"],
  behaviors: [],
  hubs: [],
  showcase: "/overlay",
});
