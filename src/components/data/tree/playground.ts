import { definePlayground } from "../../meta.ts";

interface Values { open: string; icons: boolean; meta: boolean; chevron: string; color: string }

export default definePlayground<Values>({
  options: [
    { key: "open", label: "Başlangıçta açık", default: "some", options: [{ value: "none", label: "kapalı" }, { value: "some", label: "src/ui" }, { value: "all", label: "tümü" }] },
    { key: "chevron", label: "Açma oku", default: "on", options: [{ value: "on", label: "ok" }, { value: "own", label: "kendi işaretim (+ / −)" }, { value: "off", label: "yok" }] },
    { key: "color", label: "Seçili satır rengi", default: "", options: [{ value: "", label: "vurgu rengi" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }, { value: "success", label: "yeşil" }], prop: "m:color" },
    { key: "icons", label: "İkon", default: true },
    { key: "meta", label: "Sağdaki bilgi", default: true },
  ],
});
