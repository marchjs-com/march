import { definePlayground } from "../../meta.ts";

interface Values { orientation: string; badges: boolean; indicator: string; color: string; tooltips: boolean; showLabels: boolean }

export default definePlayground<Values>({
  options: [
    { key: "orientation", label: "Yön", default: "vertical", options: [{ value: "vertical", label: "dikey" }, { value: "horizontal", label: "yatay" }] },
    { key: "badges", label: "Rozetler", default: true },
    { key: "indicator", label: "Etkin görünüm çizgisi", default: "glide", options: [{ value: "glide", label: "kayarak gider" }, { value: "fade", label: "yerinde belirir" }, { value: "none", label: "hareketsiz" }, { value: "off", label: "çizgi yok" }] },
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "tema" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }] },
    { key: "showLabels", label: "Adlar ikonun altında", default: false },
    { key: "tooltips", label: "Ad ipuçları (üstüne gelince)", default: true, visibleWhen: (v) => !v.showLabels },
  ],
});
