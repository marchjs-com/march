import { definePlayground } from "../../meta.ts";

interface Values { variant: string; size: string; eyebrow: boolean; note: boolean; backdrop: boolean; reveal: string; frameBar: boolean; tilt: boolean }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Varyant", default: "mesh", kind: "cards", options: [{ value: "centered", label: "ortada" }, { value: "split", label: "bölünmüş" }, { value: "video", label: "video" }, { value: "mesh", label: "gradyan ağ" }, { value: "aurora", label: "aurora" }, { value: "product", label: "ürün" }, { value: "parallax", label: "parallax" }] },
    { key: "size", label: "Yükseklik", default: "md", options: [{ value: "md", label: "orta" }, { value: "lg", label: "büyük" }] },
    { key: "eyebrow", label: "Üst etiket", default: true },
    { key: "note", label: "Alt not", default: true },
    { key: "backdrop", label: "Arka plan katmanları", default: true, visibleWhen: (v) => v.variant !== "video" && v.variant !== "parallax" },
    { key: "reveal", label: "Giriş hareketi", default: "up", options: [{ value: "up", label: "aşağıdan" }, { value: "blur", label: "netleşme" }, { value: "flip", label: "dönüş" }, { value: "own", label: "kendi hareketim" }, { value: "none", label: "yok" }] },
    { key: "frameBar", label: "Pencere çubuğu", default: true, visibleWhen: (v) => v.variant === "product" },
    { key: "tilt", label: "Eğik başla, kaydırınca düzel", default: true, visibleWhen: (v) => v.variant === "product" },
  ],
});
