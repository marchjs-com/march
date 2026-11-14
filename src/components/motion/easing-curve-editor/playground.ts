import { definePlayground } from "../../meta.ts";

interface Values { preview: string; duration: number; presets: boolean; readonly: boolean; inputs: boolean; cssLine: boolean; grid: boolean; handles: string }

export default definePlayground<Values>({
  options: [
    { key: "preview", label: "Önizleme", default: "move", kind: "segmented", options: [{ value: "move", label: "kayma" }, { value: "scale", label: "büyüme" }, { value: "fade", label: "belirme" }, { value: "none", label: "yok" }] },
    { key: "duration", label: "Süre", default: 900, min: 300, max: 2400, step: 100, unit: "ms", visibleWhen: (v) => v.preview !== "none" },
    { key: "presets", label: "Hazır eğriler", default: true },
    { key: "inputs", label: "Sayı alanları", default: true },
    { key: "cssLine", label: "CSS satırı ve kayıt notu", default: true },
    { key: "grid", label: "Izgara çizgileri", default: true },
    { key: "handles", label: "Tutamak renkleri", default: "default", options: [{ value: "default", label: "turuncu / mavi" }, { value: "purple-green", label: "mor / yeşil" }, { value: "pink-gold", label: "pembe / altın" }] },
    { key: "readonly", label: "Salt okunur", default: false },
  ],
});
