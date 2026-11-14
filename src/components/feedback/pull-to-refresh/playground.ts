import { definePlayground } from "../../meta.ts";

interface Values { threshold: number; delay: number; indicator: string; color: string; settle: boolean; disabled: boolean }

export default definePlayground<Values>({
  options: [
    { key: "threshold", label: "Eşik", default: 72, min: 40, max: 140, step: 4, unit: "px" },
    { key: "delay", label: "Yenileme süresi", default: 1200, min: 200, max: 4000, step: 100, unit: "ms" },
    { key: "indicator", label: "Gösterge", default: "on", kind: "cards", options: [{ value: "on", label: "hazır (yenile oku)" }, { value: "icon", label: "kendi ikonum" }, { value: "own", label: "kendi içeriğim (oklar)" }, { value: "off", label: "yok" }] },
    { key: "color", label: "Gösterge rengi", default: "primary", kind: "chips", options: [{ value: "primary", label: "birincil" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }, { value: "success", label: "yeşil" }], visibleWhen: (v) => v.indicator !== "off" },
    { key: "settle", label: "Geri yaylanma hareketi", default: true },
    { key: "disabled", label: "Kapalı", default: false },
  ],
});
