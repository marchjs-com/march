import { definePlayground } from "../../meta.ts";

interface Values { badges: boolean; scroll: boolean; rail: boolean; color: string; labels: boolean }

export default definePlayground<Values>({
  options: [
    { key: "scroll", label: "Kaydırdıkça dolsun", default: true },
    { key: "badges", label: "Durum rozetleri", default: true },
    { key: "labels", label: "Rozet metinleri benim (Yayında / Yapılıyor / Sırada)", default: false, visibleWhen: (v) => v.badges },
    { key: "rail", label: "Çizgi", default: true },
    { key: "color", label: "Dolgu rengi", default: "default", options: [{ value: "default", label: "marka geçişi" }, { value: "brand-purple", label: "mor" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-green", label: "yeşil" }] },
  ],
});
