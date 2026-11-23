import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Timeline",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Ordered list of events with toned dots, optional icons, formatted times (Date / epoch / ISO) or plain text, titles and bodies.",
  category: "data",
  composedOf: ["StatusDot"],
  behaviors: [],
  hubs: [],
});
