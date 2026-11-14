import { definePlayground } from "../../meta.ts";

export default definePlayground<{ step: number; format: string; showValue: boolean }>({
  options: [
    { key: "step", label: "Adım", default: 5, options: [1, 5, 10, 25] },
    { key: "format", label: "Gösterim", default: "percent", options: [{ value: "number", label: "sayı" }, { value: "percent", label: "yüzde" }, { value: "level", label: "düzey" }], visibleWhen: (v) => v.showValue },
    { key: "showValue", label: "Değeri yanında göster", default: true },
  ],
});
