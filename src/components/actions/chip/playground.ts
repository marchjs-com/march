import { definePlayground } from "../../meta.ts";

interface Values { tone: string; size: string; mode: string; color: string; selectedIcon: string; removeIcon: string }

export default definePlayground<Values>({
  options: [
    { key: "mode", label: "Tür", default: "toggle", options: [{ value: "static", label: "düz" }, { value: "toggle", label: "süzgeç" }, { value: "remove", label: "kaldırılabilir" }] },
    { key: "tone", label: "Ton", default: "neutral", options: ["neutral", "primary", "success", "warn", "danger", "info"] },
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md"] },
    // color (data-m-color) changes the accent: a selected filter chip and the primary tone
    { key: "color", label: "Renk (seçiliyken)", default: "", options: [{ value: "", label: "tema" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }], visibleWhen: (v) => v.mode === "toggle" || v.tone === "primary", prop: "m:color" },
    { key: "selectedIcon", label: "Seçili işareti", default: "check", options: [{ value: "check", label: "tik" }, { value: "own", label: "kalp" }, { value: "off", label: "yok" }], visibleWhen: (v) => v.mode === "toggle" },
    { key: "removeIcon", label: "Kaldırma ikonu", default: "x", options: [{ value: "x", label: "çarpı" }, { value: "own", label: "çöp kutusu" }], visibleWhen: (v) => v.mode === "remove" },
  ],
});
