import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Button",
  status: "stable",
  since: "0.1.0",
  summary: "Button in five variants and three sizes with icons, loading (locks and spins), router links (href) and block width; ActionButton draws an action() with its guard, confirm and toasts.",
  category: "actions",
  composedOf: [],
  behaviors: ["action"],
  hubs: [],
  showcase: "/buttons",
});
