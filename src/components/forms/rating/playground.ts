import { definePlayground } from "../../meta.ts";

interface Values { max: number; size: string; readonly: boolean; color: string; mark: string; animate: boolean }

export default definePlayground<Values>({
  options: [
    { key: "max", label: "Yıldız", default: 5, kind: "segmented", options: [3, 5, 10] },
    { key: "size", label: "Boyut", default: "lg", kind: "segmented", options: ["sm", "md", "lg"] },
    { key: "readonly", label: "Salt okunur (yarım yıldız)", default: false },
    { key: "mark", label: "İşaret", default: "star", options: [{ value: "star", label: "yıldız" }, { value: "heart", label: "kalp" }, { value: "number", label: "sayı (kendi çizimim)" }] },
    { key: "animate", label: "Hareket (büyüme, geçiş)", default: true },
    { key: "color", label: "Renk", default: "primary", kind: "chips", options: [{ value: "primary", label: "tema" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }, { value: "brand-pink", label: "pembe" }] , prop: "m:color"},
  ],
});
