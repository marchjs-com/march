import { definePlayground } from "../../meta.ts";

interface Values { gallery: boolean; next: boolean; facts: boolean; color: string; reveal: string }

export default definePlayground<Values>({
  options: [
    { key: "gallery", label: "Galeri", default: true },
    { key: "next", label: "Sonraki proje", default: true },
    { key: "facts", label: "Künye (rol, müşteri, yıl)", default: true },
    { key: "color", label: "Kategori satırı rengi", default: "default", options: [{ value: "default", label: "vurgu rengi" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }, { value: "brand-green", label: "yeşil" }] },
    { key: "reveal", label: "Giriş hareketi", default: "up", options: [{ value: "up", label: "yukarı" }, { value: "blur", label: "bulanık" }, { value: "scale", label: "ölçek" }, { value: "off", label: "yok" }] },
  ],
});
