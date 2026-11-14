import { definePlayground } from "../../meta.ts";

interface Values { chrome: string; snap: boolean; resizable: boolean; color: string; stripe: boolean; icons: boolean }

export default definePlayground<Values>({
  options: [
    { key: "chrome", label: "Görünüm", default: "hadi", options: [{ value: "hadi", label: "HADİ" }, { value: "mac", label: "Mac" }, { value: "windows", label: "Windows" }] },
    { key: "snap", label: "Kenara kenetlen", default: true },
    { key: "resizable", label: "Boyutlanabilir", default: true },
    { key: "color", label: "Vurgu rengi", default: "primary", options: [{ value: "primary", label: "vurgu" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }, { value: "success", label: "yeşil" }], visibleWhen: (v) => v.chrome === "hadi" },
    { key: "stripe", label: "Marka şeridi", default: true, visibleWhen: (v) => v.chrome === "hadi" },
    { key: "icons", label: "Kendi düğme ikonlarım", default: false },
  ],
});
