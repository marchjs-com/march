import { definePlayground } from "../../meta.ts";

interface Values { corner: string; icon: string; variant: string; color: string; size: string; show: string; ring: boolean }

export default definePlayground<Values>({
  options: [
    { key: "corner", label: "Köşe", default: "top-end", options: [{ value: "top-start", label: "üst baş" }, { value: "top-end", label: "üst son" }, { value: "bottom-start", label: "alt baş" }, { value: "bottom-end", label: "alt son" }] },
    { key: "icon", label: "İçerik", default: "video", options: [{ value: "video", label: "video" }, { value: "arrow", label: "ok" }, { value: "plus", label: "artı" }, { value: "text", label: "metin" }] },
    { key: "variant", label: "Görünüm", default: "scrim", options: [{ value: "scrim", label: "koyu cam" }, { value: "surface", label: "yüzey" }, { value: "solid", label: "dolu" }] },
    { key: "color", label: "Renk", default: "none", options: [{ value: "none", label: "varsayılan" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "success", label: "yeşil" }], prop: "m:color" },
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md", "lg"] },
    { key: "show", label: "Görünme", default: "always", options: [{ value: "always", label: "hep" }, { value: "hover", label: "üstüne gelince" }] },
    { key: "ring", label: "Halka (avatar rozetinde)", default: true },
  ],
});
