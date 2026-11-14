import { definePlayground } from "../../meta.ts";

interface Values { width: number; size: string; labels: boolean; motion: string; moreIcon: string; color: string }

export default definePlayground<Values>({
  options: [
    { key: "width", label: "Genişlik", default: 520, min: 180, max: 760, step: 20, unit: "px" },
    { key: "size", label: "Boyut", default: "sm", options: ["sm", "md"] },
    { key: "labels", label: "Etiketleri göster", default: false },
    { key: "motion", label: "Geri gelme hareketi", default: "pop", options: [{ value: "pop", label: "büyüyerek" }, { value: "fade", label: "belirerek" }, { value: "own", label: "kendi hareketim (yukarıdan)" }, { value: "none", label: "yok" }] },
    { key: "moreIcon", label: "Daha fazla ikonu", default: "more", options: [{ value: "more", label: "üç nokta" }, { value: "menu", label: "menü" }, { value: "plus", label: "artı" }] },
    { key: "color", label: "Basılı düğme rengi", default: "", options: [{ value: "", label: "tema" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }] },
  ],
});
