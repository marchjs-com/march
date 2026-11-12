import { definePlayground } from "../../meta.ts";

export default definePlayground<{ steps: number; layout: string; color: string }>({
  options: [
    { key: "steps", label: "Adım", default: 3, options: [2, 3, 4] },
    { key: "layout", label: "Alan düzeni", default: "stack", options: [{ value: "stack", label: "alt alta" }, { value: "grid", label: "ızgara" }] },
    { key: "color", label: "Renk", default: "primary", options: [{ value: "primary", label: "birincil" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }] },
  ],
});
