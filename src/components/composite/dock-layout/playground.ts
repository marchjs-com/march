import { definePlayground } from "../../meta.ts";

interface Values { preset: string; actions: string; collapsed: boolean; icons: boolean; motion: boolean }

export default definePlayground<Values>({
  options: [
    { key: "preset", label: "Başlangıç yerleşimi", default: "ide", options: [{ value: "ide", label: "IDE" }, { value: "columns", label: "üç sütun" }, { value: "single", label: "tek grup" }] },
    { key: "collapsed", label: "Notlar şeritte başlasın", default: false },
    { key: "actions", label: "Grup düğmeleri", default: "all", kind: "segmented", options: [{ value: "all", label: "tümü" }, { value: "nomenu", label: "menüsüz" }, { value: "max", label: "yalnız büyüt" }, { value: "none", label: "yok" }] },
    { key: "icons", label: "Kendi ikonlarım ve ipucu metinlerim", default: false },
    { key: "motion", label: "Hareket (yerleşme kayması)", default: true },
  ],
});
