import { definePlayground } from "../../meta.ts";

interface Values { base: string; preview: boolean; tabs: string; readonly: boolean }

export default definePlayground<Values>({
  options: [
    { key: "base", label: "Başlangıç", default: "hadi", kind: "segmented", options: [{ value: "hadi", label: "HADİ" }, { value: "night", label: "Gece" }, { value: "neon", label: "Neon" }, { value: "scratch", label: "Sıfırdan" }] },
    { key: "tabs", label: "Bölümler", default: "all", kind: "segmented", options: [{ value: "all", label: "hepsi" }, { value: "colors", label: "yalnız renk" }, { value: "noexport", label: "çıktısız" }] },
    { key: "preview", label: "Canlı önizleme", default: true },
    { key: "readonly", label: "Salt okunur", default: false },
  ],
});
