import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "DateTimeInput",
  status: "stable",
  since: "0.1.0",
  summary: "A DatePicker and a TimeInput editing one ISO timestamp in local time.",
  category: "forms",
  composedOf: ["DatePicker","TimeInput"],
  behaviors: ["mask"],
  hubs: [],
});
