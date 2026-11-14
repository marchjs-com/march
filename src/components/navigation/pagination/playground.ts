import { definePlayground } from "../../meta.ts";

interface Values { variant: string; pages: number; siblings: number; controls: string; gap: string; color: string; info: boolean; status: boolean; sizes: boolean }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Görünüm", default: "numbers", options: [{ value: "numbers", label: "numaralı" }, { value: "simple", label: "yalın (önceki / sonraki)" }, { value: "cursor", label: "yalın, sayfa sayısı bilinmeden" }] },
    { key: "pages", label: "Sayfa sayısı", default: 20, min: 1, max: 60, visibleWhen: (v) => v.variant !== "cursor" },
    { key: "siblings", label: "Komşu sayfa", default: 1, options: [0, 1, 2], visibleWhen: (v) => v.variant === "numbers" },
    { key: "controls", label: "Önceki / Sonraki", default: "icon", options: [{ value: "icon", label: "varsayılan" }, { value: "text", label: "kendi metnim" }, { value: "off", label: "yok" }] },
    { key: "gap", label: "Boşluk işareti", default: "dots", options: [{ value: "dots", label: "üç nokta" }, { value: "own", label: "kendi işaretim (·)" }, { value: "off", label: "yok" }], visibleWhen: (v) => v.variant === "numbers" },
    { key: "color", label: "Etkin sayfa rengi", default: "", options: [{ value: "", label: "nötr" }, { value: "primary", label: "tema" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }], visibleWhen: (v) => v.variant === "numbers" },
    { key: "info", label: "Aralık metni (21–40 / 200)", default: true, visibleWhen: (v) => v.variant === "simple" },
    { key: "status", label: "Sayfa metni (Sayfa 2 / 20)", default: true, visibleWhen: (v) => v.variant === "simple" },
    { key: "sizes", label: "Sayfa boyutu seçimi", default: true, visibleWhen: (v) => v.variant === "simple" },
  ],
});
