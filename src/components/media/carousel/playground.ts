import { definePlayground } from "../../meta.ts";

interface Values { perView: number; slides: number; arrows: string; dots: string; color: string }

export default definePlayground<Values>({
  options: [
    { key: "perView", label: "Görünen", default: 2, kind: "segmented", options: [1, 2, 3, 4] },
    { key: "slides", label: "Slayt sayısı", default: 6, min: 3, max: 10, step: 1 },
    { key: "arrows", label: "Oklar", default: "on", kind: "segmented", options: [{ value: "on", label: "hazır" }, { value: "own", label: "kendi ikonlarım" }, { value: "off", label: "yok" }] },
    { key: "dots", label: "Noktalar", default: "on", kind: "segmented", options: [{ value: "on", label: "hazır" }, { value: "own", label: "numaralı" }, { value: "off", label: "yok" }] },
    { key: "color", label: "Etkin nokta rengi", default: "primary", kind: "chips", options: [{ value: "primary", label: "birincil" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }, { value: "brand-green", label: "yeşil" }], visibleWhen: (v) => v.dots !== "off" },
  ],
});
