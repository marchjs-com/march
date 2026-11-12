import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Pricing",
  status: "experimental",
  since: "0.1.0",
  summary: "Plans with a monthly / yearly switch: prices roll like an odometer, the switch thumb slides, the featured plan glows.",
  composedOf: ["Card", "Badge", "Segmented", "Counter", "Reveal"],
  behaviors: ["motion engine"],
  showcase: "/web",
});
