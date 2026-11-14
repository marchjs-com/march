import { definePlayground } from "../../meta.ts";

export default definePlayground<{ count: number; color: string; icons: string; indicator: string; locked: boolean }>({
  options: [
    { key: "count", label: "Seçenek", default: 3, options: [2, 3, 4, 5] },
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "nötr" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-purple", label: "mor" }], prop: "m:color" },
    { key: "indicator", label: "Seçili gösterge", default: "fill", options: [{ value: "fill", label: "yerinde" }, { value: "slide", label: "kayan" }] },
    { key: "icons", label: "İkon", default: "none", options: [{ value: "none", label: "yok" }, { value: "text", label: "ikon + metin" }, { value: "only", label: "yalnız ikon" }] },
    { key: "locked", label: "Son seçenek kapalı (ipucuyla)", default: false },
  ],
});
