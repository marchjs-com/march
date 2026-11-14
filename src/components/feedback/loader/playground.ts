import { definePlayground } from "../../meta.ts";

interface Values { text: boolean; overlay: boolean; spinner: string; color: string }

export default definePlayground<Values>({
  options: [
    { key: "text", label: "Görünür metin", default: true },
    { key: "spinner", label: "Dönen halka", default: "on", kind: "segmented", options: [{ value: "on", label: "hazır halka" }, { value: "own", label: "kendi işaretim" }, { value: "off", label: "yok" }] },
    { key: "color", label: "Halka rengi", default: "theme", kind: "chips", options: [{ value: "theme", label: "tema" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }, { value: "success", label: "yeşil" }], visibleWhen: (v) => v.spinner === "on" },
    { key: "overlay", label: "İçeriğin üstünde (perde)", default: true },
  ],
});
