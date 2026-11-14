import { definePlayground } from "../../meta.ts";

export default definePlayground<{ steps: number; layout: string; color: string; stepper: boolean; progress: boolean; count: boolean; backButton: boolean; ownLabels: boolean }>({
  options: [
    { key: "steps", label: "Adım", default: 3, options: [2, 3, 4] },
    { key: "layout", label: "Alan düzeni", default: "stack", options: [{ value: "stack", label: "alt alta" }, { value: "grid", label: "ızgara" }] },
    { key: "color", label: "Renk", default: "primary", options: [{ value: "primary", label: "birincil" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }] },
    { key: "stepper", label: "Aşama listesi", default: true },
    { key: "progress", label: "İlerleme çubuğu", default: true },
    { key: "count", label: "“Adım 2 / 3” yazısı", default: true },
    { key: "backButton", label: "Geri düğmesi", default: true },
    { key: "ownLabels", label: "Kendi düğme metinlerim", default: false },
  ],
});
