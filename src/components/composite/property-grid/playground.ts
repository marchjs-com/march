import { definePlayground } from "../../meta.ts";

interface Values { layout: string; search: boolean; save: boolean; historyButtons: boolean; resetButtons: boolean; changeMarks: boolean; footer: boolean; ownLabels: boolean }

export default definePlayground<Values>({
  options: [
    { key: "layout", label: "Yerleşim", default: "auto", options: [{ value: "auto", label: "yan yana" }, { value: "stacked", label: "üst üste" }] },
    { key: "search", label: "Arama alanı", default: true },
    { key: "save", label: "Kaydet düğmesi (onSave)", default: true },
    { key: "historyButtons", label: "Geri al / yinele düğmeleri", default: true },
    { key: "resetButtons", label: "Satırda “kaydedilene dön” düğmesi", default: true },
    { key: "changeMarks", label: "Değişiklik işaretleri", default: true },
    { key: "footer", label: "Alt çubuk", default: true },
    { key: "ownLabels", label: "Kendi metinlerim", default: false },
  ],
});
