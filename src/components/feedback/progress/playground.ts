import { definePlayground } from "../../meta.ts";

interface Values { variant: string; parts: number; timed: boolean; indeterminate: boolean; value: number; colors: string; paint: string; tone: string; size: string; showValue: boolean; valueText: string }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Görünüm", default: "bar", kind: "segmented", options: [{ value: "bar", label: "çubuk" }, { value: "line", label: "ince çizgi" }] },
    { key: "parts", label: "Parça sayısı (0: tek parça)", default: 0, min: 0, max: 8, step: 1 },
    { key: "timed", label: "Parçalar süreyle dolsun", default: false, visibleWhen: (v) => v.parts > 0 },
    { key: "indeterminate", label: "Belirsiz (değer yok)", default: false, visibleWhen: (v) => v.parts === 0 },
    { key: "value", label: "Değer", default: 62, min: 0, max: 100, step: 1, unit: "%", visibleWhen: (v) => !(v.parts === 0 && v.indeterminate) && !(v.parts > 0 && v.timed) },
    { key: "colors", label: "Renkler", default: "tone", kind: "cards", options: [{ value: "tone", label: "tonla tek renk" }, { value: "brand", label: "dört marka rengi" }, { value: "pair", label: "iki renk" }] },
    { key: "paint", label: "Dizilim", default: "gradient", kind: "segmented", options: ["gradient", "segments", "cycle"], visibleWhen: (v) => v.colors !== "tone" && v.variant === "bar" && v.parts === 0 },
    { key: "tone", label: "Ton", default: "primary", kind: "chips", options: [{ value: "primary", label: "birincil" }, { value: "success", label: "başarı" }, { value: "warn", label: "uyarı" }, { value: "danger", label: "tehlike" }, { value: "info", label: "bilgi" }], visibleWhen: (v) => v.colors === "tone" },
    { key: "size", label: "Boyut", default: "lg", kind: "segmented", options: ["sm", "md", "lg"] },
    { key: "showValue", label: "Değeri göster", default: true, visibleWhen: (v) => v.parts === 0 && !v.indeterminate },
    { key: "valueText", label: "Değer metni", default: "percent", kind: "segmented", options: [{ value: "percent", label: "yüzde" }, { value: "own", label: "kendi metnim (MB)" }], visibleWhen: (v) => v.parts === 0 && !v.indeterminate && v.showValue },
  ],
});
