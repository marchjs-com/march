import { definePlayground } from "../../meta.ts";

interface Values { tools: string; hints: boolean; size: string; color: string; icons: string; labels: boolean; disabled: boolean }

export default definePlayground<Values>({
  options: [
    { key: "tools", label: "Araçlar", default: "default", options: [{ value: "default", label: "hazır liste" }, { value: "short", label: "kalın, italik, bağlantı" }, { value: "all", label: "tümü (başlık, liste, kod…)" }] },
    { key: "hints", label: "İpucunda kısayol", default: true },
    { key: "size", label: "Boyut", default: "sm", options: ["xs", "sm", "md"] },
    { key: "color", label: "Basılı işaretin rengi", default: "", options: [{ value: "", label: "vurgu" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }] },
    { key: "icons", label: "İkonlar", default: "default", options: [{ value: "default", label: "hazır" }, { value: "letters", label: "harf (B, I, S)" }] },
    { key: "labels", label: "Kendi adlarım", default: false },
    { key: "disabled", label: "Devre dışı", default: false },
  ],
});
