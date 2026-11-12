import { definePlayground } from "../../meta.ts";

type V = { length: number; pattern: string; colors: string; font: string; size: string; variant: string; groups: boolean; mask: boolean }

export default definePlayground<V>({
  options: [
    { key: "length", label: "Uzunluk", default: 6, min: 3, max: 12 },
    { key: "pattern", label: "Karakter", default: "numeric", options: ["numeric", "alpha", "alphanumeric"] },
    { key: "colors", label: "Renkler", default: "brand", options: ["brand", "palette", "single"] },
    // a masked code shows dots: the font has no effect then
    { key: "font", label: "Yazı tipi", default: "display", options: ["display", "mono", "body"], visibleWhen: (v) => !v.mask },
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md", "lg"] },
    { key: "variant", label: "Biçim", default: "outline", options: ["outline", "filled", "underline"] },
    // two groups need at least four boxes
    { key: "groups", label: "Gruplu", default: true, visibleWhen: (v) => v.length >= 4 },
    { key: "mask", label: "Gizli (PIN)", default: false },
  ],
});
