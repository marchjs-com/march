import { definePlayground } from "../../meta.ts";

interface Values { icon: boolean; count: boolean; actions: boolean; upper: boolean; rule: boolean; size: string; color: string }

export default definePlayground<Values>({
  options: [
    { key: "upper", label: "Büyük harf", default: true },
    { key: "icon", label: "İkon", default: false },
    { key: "count", label: "Sayı", default: true },
    { key: "actions", label: "Eylem düğmesi", default: true },
    { key: "rule", label: "Çizgi", default: false },
    { key: "size", label: "Boyut", default: "sm", options: ["sm", "md"] },
    { key: "color", label: "Renk", default: "none", options: [{ value: "none", label: "soluk" }, { value: "primary", label: "aksan" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }] },
  ],
});
