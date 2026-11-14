import { definePlayground } from "../../meta.ts";

interface Values { preset: string; dir: string; tray: boolean; actions: string; icons: boolean; motion: boolean }

export default definePlayground<Values>({
  options: [
    { key: "preset", label: "Başlangıç yerleşimi", default: "ide", options: [{ value: "ide", label: "IDE" }, { value: "columns", label: "üç sütun" }, { value: "single", label: "tek grup" }] },
    { key: "dir", label: "Yön", default: "ltr", options: [{ value: "ltr", label: "soldan sağa" }, { value: "rtl", label: "sağdan sola" }] },
    { key: "tray", label: "Bir paneli küçültülmüş başlat", default: false },
    { key: "actions", label: "Grup düğmeleri", default: "all", kind: "segmented", options: [{ value: "all", label: "tümü" }, { value: "max", label: "yalnız büyüt" }, { value: "none", label: "yok" }] },
    { key: "icons", label: "Kendi ikonlarım ve ipucu metinlerim", default: false },
    { key: "motion", label: "Hareket (büyütme, yerleşme)", default: true },
  ],
});
