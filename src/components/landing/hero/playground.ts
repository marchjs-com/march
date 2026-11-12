import { definePlayground } from "../../meta.ts";

interface Values { variant: string; size: string; eyebrow: boolean; note: boolean }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Varyant", default: "mesh", kind: "cards", options: [{ value: "centered", label: "ortada" }, { value: "split", label: "bölünmüş" }, { value: "video", label: "video" }, { value: "mesh", label: "gradyan ağ" }, { value: "aurora", label: "aurora" }, { value: "product", label: "ürün" }, { value: "parallax", label: "parallax" }] },
    { key: "size", label: "Yükseklik", default: "md", options: [{ value: "md", label: "orta" }, { value: "lg", label: "büyük" }] },
    { key: "eyebrow", label: "Üst etiket", default: true },
    { key: "note", label: "Alt not", default: true },
  ],
});
