import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "OptionList",
  status: "experimental",
  since: "0.1.0",
  summary: "A list of choices inside a panel: radio group, listbox (one or many) or command menu; rows with lead, label, hint, trailing part and tick; arrow keys, or driven by a field (aria-activedescendant).",
  category: "forms",
  composedOf: ["SectionLabel"],
  behaviors: ["list-nav"],
  hubs: [],
  showcase: "/overlays",
});
