import { definePlayground } from "../../meta.ts";

interface Values { layout: string; outcome: string; doneIcon: string; motion: boolean; texts: boolean }

export default definePlayground<Values>({
  options: [
    { key: "layout", label: "Düzen", default: "inline", options: [{ value: "inline", label: "tek satır" }, { value: "stacked", label: "alt alta" }] },
    { key: "outcome", label: "Sunucu yanıtı", default: "ok", options: [{ value: "ok", label: "başarılı" }, { value: "fail", label: "hata" }] },
    { key: "doneIcon", label: "Onay simgesi", default: "check", options: [{ value: "check", label: "tik" }, { value: "own", label: "kendi simgem" }, { value: "off", label: "yok" }] },
    { key: "motion", label: "Hareket (sallanma, kapanma)", default: true },
    { key: "texts", label: "Kendi metinlerim", default: false },
  ],
});
