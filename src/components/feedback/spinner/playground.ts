import { definePlayground } from "../../meta.ts";

interface Values { size: string; colors: string; color: string }

export default definePlayground<Values>({
  options: [
    { key: "size", label: "Boyut", default: "lg", kind: "segmented", options: ["sm", "md", "lg"] },
    { key: "colors", label: "Renkler", default: "brand", kind: "cards", options: [{ value: "brand", label: "dört marka rengi" }, { value: "pair", label: "iki renk" }, { value: "single", label: "tek renk" }] },
    { key: "color", label: "Tek rengin tonu", default: "theme", kind: "chips", options: [{ value: "theme", label: "tema" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }, { value: "success", label: "yeşil" }, { value: "danger", label: "kırmızı" }], visibleWhen: (v) => v.colors === "single" },
  ],
});
