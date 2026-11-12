import { definePlayground } from "../../meta.ts";

interface Values { layout: string; search: boolean; save: boolean }

export default definePlayground<Values>({
  options: [
    { key: "layout", label: "Yerleşim", default: "auto", options: [{ value: "auto", label: "yan yana" }, { value: "stacked", label: "üst üste" }] },
    { key: "search", label: "Arama alanı", default: true },
    { key: "save", label: "Kaydet düğmesi (onSave)", default: true },
  ],
});
