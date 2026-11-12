import { definePlayground } from "../../meta.ts";

export default definePlayground<{ count: number; color: string }>({
  options: [
    { key: "count", label: "Seçenek", default: 3, options: [2, 3, 4, 5] },
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "nötr" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-purple", label: "mor" }] },
  ],
});
