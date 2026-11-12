import { definePlayground } from "../../meta.ts";

interface Values { aspect: string; maxZoom: number; preview: boolean; readonly: boolean }

export default definePlayground<Values>({
  options: [
    { key: "aspect", label: "Oran", default: "choices", kind: "segmented", options: [{ value: "choices", label: "seçenekli" }, { value: "1", label: "1:1 sabit" }, { value: "1.7778", label: "16:9 sabit" }] },
    { key: "maxZoom", label: "En çok yakınlaştırma", default: 4, min: 2, max: 8, step: 1, unit: "×" },
    { key: "preview", label: "Sonuç önizlemesi", default: true },
    { key: "readonly", label: "Salt okunur", default: false },
  ],
});
