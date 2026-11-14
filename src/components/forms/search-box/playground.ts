import { definePlayground } from "../../meta.ts";

interface Values { size: string; variant: string; icon: string; clear: string; debounce: number; hint: boolean }

export default definePlayground<Values>({
  options: [
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md"] },
    { key: "variant", label: "Görünüm", default: "field", options: [{ value: "field", label: "alan" }, { value: "plain", label: "kenarsız" }] },
    { key: "icon", label: "İkon", default: "on", options: [{ value: "on", label: "büyüteç" }, { value: "own", label: "kendi ikonum" }, { value: "off", label: "yok" }] },
    { key: "clear", label: "Temizle düğmesi", default: "on", options: [{ value: "on", label: "var" }, { value: "own", label: "kendi ikonum" }, { value: "off", label: "yok" }] },
    { key: "hint", label: "Kısayol ipucu ( / )", default: true },
    { key: "debounce", label: "Gecikme", default: 250, min: 0, max: 1000, step: 50, unit: "ms" },
  ],
});
