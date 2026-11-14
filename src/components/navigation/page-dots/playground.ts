import { definePlayground } from "../../meta.ts";

interface Values { count: number; interactive: boolean; variant: string; size: string; color: string; dot: string; orientation: string }

export default definePlayground<Values>({
  options: [
    { key: "count", label: "Sayfa sayısı", default: 5, min: 2, max: 10, step: 1 },
    { key: "interactive", label: "Tıklanabilir (onChange)", default: true },
    { key: "variant", label: "Görünüm", default: "pill", options: [{ value: "pill", label: "etkin olan uzun" }, { value: "dot", label: "eşit noktalar" }], visibleWhen: (v) => v.dot === "default" },
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md", "lg"], visibleWhen: (v) => v.dot === "default" },
    { key: "color", label: "Renk", default: "primary", options: [{ value: "primary", label: "ana renk" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-green", label: "yeşil" }, { value: "neutral", label: "nötr" }] },
    { key: "dot", label: "Nokta içeriği", default: "default", options: [{ value: "default", label: "nokta" }, { value: "own", label: "kendi içeriğim (sayı)" }] },
    { key: "orientation", label: "Yön", default: "horizontal", options: [{ value: "horizontal", label: "yatay" }, { value: "vertical", label: "dikey" }] },
  ],
});
