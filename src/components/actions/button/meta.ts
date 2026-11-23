import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Button",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Button in six variants (one a link-like text button) and three sizes with icons, loading (locks and spins), a pressed toggle state, pill shape, router links (href) and block width; ActionButton draws an action() or a plain { label, run } with its guard, confirm and toasts.",
  category: "actions",
  composedOf: ["Spinner"],
  behaviors: ["action"],
  hubs: [],
});
