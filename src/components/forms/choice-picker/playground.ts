import { definePlayground } from "../../meta.ts";

export default definePlayground<{ count: number; kind: string }>({
  options: [
    { key: "count", label: "Seçenek sayısı", default: 4, options: [3, 4, 8, 12] },
    { key: "kind", label: "Görünüm", default: "auto", options: [{ value: "auto", label: "otomatik" }, { value: "segmented", label: "segmented" }, { value: "chips", label: "çipler" }, { value: "combobox", label: "combobox" }] },
  ],
});
