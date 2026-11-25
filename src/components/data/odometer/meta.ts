import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Odometer",
  status: "experimental",
  category: "data",
  since: "0.3.17",
  summary: "A counter on number drums (a mileage counter, a meter, a flip clock): fixed digits with leading zeros, red fraction drums, a unit; mechanical, digital or flip look. Rolls through CountRoll.",
  composedOf: ["CountRoll"],
  behaviors: ["motion engine", "pipes (number)"],
  hubs: [],
});
