import { definePlayground } from "../../meta.ts";

interface Values { private: boolean; size: string; block: boolean; labels: string; icon: string; color: string; burst: boolean; morph: boolean }

export default definePlayground<Values>({
  options: [
    { key: "private", label: "Gizli hesap (istek)", default: false },
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md"] },
    { key: "block", label: "Tam genişlik", default: false },
    { key: "labels", label: "Metinler", default: "default", options: [{ value: "default", label: "Takip et / Takip ediliyor" }, { value: "own", label: "kendi metnim (Katıl / Üyesin)" }] },
    { key: "icon", label: "İkon", default: "on", options: [{ value: "on", label: "+ / tik" }, { value: "own", label: "kendi ikonum" }, { value: "off", label: "yok" }] },
    { key: "color", label: "Renk", default: "brand-blue", options: [{ value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }, { value: "brand-orange", label: "turuncu" }] },
    { key: "burst", label: "Patlama", default: true },
    { key: "morph", label: "Geçiş hareketi", default: true },
  ],
});
