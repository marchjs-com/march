import { definePlayground } from "../../meta.ts";

interface Values { start: string; presets: boolean; output: boolean; readonly: boolean; preview: boolean; angles: string; hint: boolean; labels: boolean }

export default definePlayground<Values>({
  options: [
    { key: "start", label: "Başlangıç", default: "hadi", kind: "segmented", options: [{ value: "hadi", label: "HADİ" }, { value: "radial", label: "dairesel" }, { value: "conic", label: "konik" }] },
    { key: "presets", label: "Hazır gradyanlar", default: true },
    { key: "output", label: "CSS çıktısı", default: true },
    { key: "preview", label: "Büyük önizleme", default: true },
    { key: "angles", label: "Hazır açılar", default: "eight", kind: "segmented", options: [{ value: "eight", label: "8 açı" }, { value: "four", label: "4 açı" }, { value: "none", label: "yok" }] },
    { key: "hint", label: "İpucu satırı", default: true },
    { key: "labels", label: "Kendi metinlerim", default: false },
    { key: "readonly", label: "Salt okunur", default: false },
  ],
});
