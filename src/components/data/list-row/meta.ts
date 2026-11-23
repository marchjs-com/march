import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ListRow",
  status: "experimental",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "The row lists are made of: lead (icon, avatar, dot, thumbnail) + title + sub text + trail and actions; a link, a button or a plain element that takes any role, ARIA and tabindex; active, selected, disabled; long text scrolls, is cut or wraps.",
  category: "data",
  composedOf: ["OverflowText"],
  behaviors: [],
  hubs: [],
});
