import { definePlayground } from "../../meta.ts";

interface Values { size: string; variant: string; shape: string; color: string }

export default definePlayground<Values>({
  options: [
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md", "lg"] },
    { key: "variant", label: "Görünüm", default: "soft", options: [{ value: "soft", label: "yumuşak" }, { value: "outline", label: "çerçeveli" }, { value: "solid", label: "dolu" }] },
    { key: "shape", label: "Biçim", default: "square", options: [{ value: "square", label: "kare" }, { value: "round", label: "yuvarlak" }] },
    { key: "color", label: "Renk", default: "tones", options: [{ value: "tones", label: "tonlar" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }, { value: "cat-5", label: "palet 5" }], prop: "m:color" },
  ],
});
