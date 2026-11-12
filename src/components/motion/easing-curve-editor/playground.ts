import { definePlayground } from "../../meta.ts";

interface Values { preview: string; duration: number; presets: boolean; readonly: boolean }

export default definePlayground<Values>({
  options: [
    { key: "preview", label: "Önizleme", default: "move", kind: "segmented", options: [{ value: "move", label: "kayma" }, { value: "scale", label: "büyüme" }, { value: "fade", label: "belirme" }, { value: "none", label: "yok" }] },
    { key: "duration", label: "Süre", default: 900, min: 300, max: 2400, step: 100, unit: "ms", visibleWhen: (v) => v.preview !== "none" },
    { key: "presets", label: "Hazır eğriler", default: true },
    { key: "readonly", label: "Salt okunur", default: false },
  ],
});
