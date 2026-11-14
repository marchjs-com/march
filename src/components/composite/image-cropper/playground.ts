import { definePlayground } from "../../meta.ts";

interface Values { aspect: string; maxZoom: number; preview: boolean; readonly: boolean; grid: boolean; hint: boolean; tools: string; sliders: string; labels: boolean }

export default definePlayground<Values>({
  options: [
    { key: "aspect", label: "Oran", default: "choices", kind: "segmented", options: [{ value: "choices", label: "seçenekli" }, { value: "1", label: "1:1 sabit" }, { value: "1.7778", label: "16:9 sabit" }] },
    { key: "maxZoom", label: "En çok yakınlaştırma", default: 4, min: 2, max: 8, step: 1, unit: "×" },
    { key: "preview", label: "Sonuç önizlemesi", default: true },
    { key: "grid", label: "Kılavuz ızgarası", default: true },
    { key: "tools", label: "Düğmeler", default: "all", kind: "segmented", options: [{ value: "all", label: "tümü" }, { value: "rotate", label: "yalnız döndür" }, { value: "none", label: "yok" }] },
    { key: "sliders", label: "Kaydırıcılar", default: "all", kind: "segmented", options: [{ value: "all", label: "ikisi" }, { value: "zoom", label: "yalnız yakınlaştırma" }, { value: "none", label: "yok" }] },
    { key: "hint", label: "Klavye ipucu", default: true },
    { key: "labels", label: "Kendi metinlerim", default: false },
    { key: "readonly", label: "Salt okunur", default: false },
  ],
});
