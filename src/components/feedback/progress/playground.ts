import { definePlayground } from "../../meta.ts";

interface Values { indeterminate: boolean; value: number; colors: string; paint: string; tone: string; size: string; showValue: boolean; valueText: string }

export default definePlayground<Values>({
  options: [
    { key: "indeterminate", label: "Belirsiz (değer yok)", default: false },
    { key: "value", label: "Değer", default: 62, min: 0, max: 100, step: 1, unit: "%", visibleWhen: (v) => !v.indeterminate },
    { key: "colors", label: "Renkler", default: "tone", kind: "cards", options: [{ value: "tone", label: "tonla tek renk" }, { value: "brand", label: "dört marka rengi" }, { value: "pair", label: "iki renk" }] },
    { key: "paint", label: "Dizilim", default: "gradient", kind: "segmented", options: ["gradient", "segments", "cycle"], visibleWhen: (v) => v.colors !== "tone" },
    { key: "tone", label: "Ton", default: "primary", kind: "chips", options: [{ value: "primary", label: "birincil" }, { value: "success", label: "başarı" }, { value: "warn", label: "uyarı" }, { value: "danger", label: "tehlike" }, { value: "info", label: "bilgi" }], visibleWhen: (v) => v.colors === "tone" },
    { key: "size", label: "Boyut", default: "lg", kind: "segmented", options: ["sm", "md", "lg"] },
    { key: "showValue", label: "Değeri göster", default: true, visibleWhen: (v) => !v.indeterminate },
    { key: "valueText", label: "Değer metni", default: "percent", kind: "segmented", options: [{ value: "percent", label: "yüzde" }, { value: "own", label: "kendi metnim (MB)" }], visibleWhen: (v) => !v.indeterminate && v.showValue },
  ],
});
