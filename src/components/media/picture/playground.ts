import { definePlayground } from "../../meta.ts";

interface Values { source: string; fit: string; eager: boolean; broken: boolean }

export default definePlayground<Values>({
  options: [
    { key: "source", label: "Kaynak", default: "object", options: [{ value: "object", label: "resim nesnesi" }, { value: "node", label: "hazır düğüm" }] },
    { key: "fit", label: "Sığdırma", default: "cover", options: [{ value: "cover", label: "kapla" }, { value: "contain", label: "sığdır" }, { value: "natural", label: "doğal boyut" }], visibleWhen: (v) => v.source === "object" },
    { key: "eager", label: "Hemen yükle (ilk ekran)", default: false, visibleWhen: (v) => v.source === "object" },
    { key: "broken", label: "Bozuk adres (yedek içerik)", default: false, visibleWhen: (v) => v.source === "object" },
  ],
});
