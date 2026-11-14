import { definePlayground } from "../../meta.ts";

interface Values { iconOnly: boolean; icon: string; copiedIcon: string; copiedLabel: string; copiedColor: string }

export default definePlayground<Values>({
  options: [
    { key: "iconOnly", label: "Yalnız ikon", default: false },
    { key: "icon", label: "İkon", default: "default", options: [{ value: "default", label: "varsayılan" }, { value: "own", label: "kendi ikonum" }] },
    { key: "copiedIcon", label: "Kopyalandı ikonu", default: "check", options: [{ value: "check", label: "tik" }, { value: "own", label: "kalp" }, { value: "off", label: "değişmesin" }], visibleWhen: (v) => v.iconOnly || v.icon === "own" },
    { key: "copiedLabel", label: "Kopyalandı metni", default: "default", options: [{ value: "default", label: "Kopyalandı" }, { value: "own", label: "Panoda!" }], visibleWhen: (v) => !v.iconOnly },
    { key: "copiedColor", label: "Kopyalandı rengi", default: "", options: [{ value: "", label: "yeşil" }, { value: "brand-blue", label: "mavi" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }] },
  ],
});
