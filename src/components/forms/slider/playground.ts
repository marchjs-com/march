import { definePlayground } from "../../meta.ts";

export default definePlayground<{ step: number; format: string; showValue: boolean; track: string; color: string }>({
  options: [
    { key: "step", label: "Adım", default: 5, options: [1, 5, 10, 25] },
    { key: "format", label: "Gösterim", default: "percent", options: [{ value: "number", label: "sayı" }, { value: "percent", label: "yüzde" }, { value: "level", label: "düzey" }], visibleWhen: (v) => v.showValue },
    { key: "showValue", label: "Değeri yanında göster", default: true },
    { key: "track", label: "İz", default: "native", options: [{ value: "native", label: "tarayıcının izi" }, { value: "ramp", label: "renk rampası" }, { value: "node", label: "kendi düğümüm (düzey bölmeleri)" }] },
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "tema" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }] },
  ],
});
