import { definePlayground } from "../../meta.ts";

interface Values { max: number; size: string; readonly: boolean; color: string }

export default definePlayground<Values>({
  options: [
    { key: "max", label: "Yıldız", default: 5, kind: "segmented", options: [3, 5, 10] },
    { key: "size", label: "Boyut", default: "lg", kind: "segmented", options: ["sm", "md", "lg"] },
    { key: "readonly", label: "Salt okunur (yarım yıldız)", default: false },
    { key: "color", label: "Renk", default: "primary", kind: "chips", options: [{ value: "primary", label: "birincil" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }] },
  ],
});
