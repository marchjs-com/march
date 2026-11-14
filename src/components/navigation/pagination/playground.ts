import { definePlayground } from "../../meta.ts";

interface Values { pages: number; siblings: number; controls: string; gap: string; color: string }

export default definePlayground<Values>({
  options: [
    { key: "pages", label: "Sayfa sayısı", default: 20, min: 1, max: 60 },
    { key: "siblings", label: "Komşu sayfa", default: 1, options: [0, 1, 2] },
    { key: "controls", label: "Önceki / Sonraki", default: "icon", options: [{ value: "icon", label: "oklar" }, { value: "text", label: "kendi metnim" }, { value: "off", label: "yok" }] },
    { key: "gap", label: "Boşluk işareti", default: "dots", options: [{ value: "dots", label: "üç nokta" }, { value: "own", label: "kendi işaretim (·)" }, { value: "off", label: "yok" }] },
    { key: "color", label: "Etkin sayfa rengi", default: "", options: [{ value: "", label: "nötr" }, { value: "primary", label: "tema" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }] },
  ],
});
