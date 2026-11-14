import { definePlayground } from "../../meta.ts";

interface Values { base: string; preview: boolean; tabs: string; readonly: boolean; presets: boolean; nameField: boolean; historyButtons: boolean; applyButton: boolean; previewControls: boolean; ownLabels: boolean }

export default definePlayground<Values>({
  options: [
    { key: "base", label: "Başlangıç", default: "hadi", kind: "segmented", options: [{ value: "hadi", label: "HADİ" }, { value: "night", label: "Gece" }, { value: "neon", label: "Neon" }, { value: "scratch", label: "Sıfırdan" }] },
    { key: "tabs", label: "Bölümler", default: "all", kind: "segmented", options: [{ value: "all", label: "hepsi" }, { value: "colors", label: "yalnız renk" }, { value: "noexport", label: "çıktısız" }] },
    { key: "preview", label: "Canlı önizleme", default: true },
    { key: "readonly", label: "Salt okunur", default: false },
    { key: "presets", label: "“Şuradan başla” satırı", default: true },
    { key: "nameField", label: "Tema adı alanı", default: true },
    { key: "historyButtons", label: "Geri al / yinele düğmeleri", default: true },
    { key: "applyButton", label: "“Uygulamaya uygula” düğmesi", default: true },
    { key: "previewControls", label: "Önizleme anahtarları (açık/koyu, yön)", default: true, visibleWhen: (v) => v.preview },
    { key: "ownLabels", label: "Kendi sekme ve düğme metinlerim", default: false },
  ],
});
