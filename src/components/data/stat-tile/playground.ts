import { definePlayground } from "../../meta.ts";

interface Values { variant: string; size: string; align: string; order: string; color: string; hint: boolean; clickable: boolean; counter: boolean }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Görünüm", default: "tile", options: [{ value: "plain", label: "yalın" }, { value: "tile", label: "yumuşak karo" }, { value: "card", label: "kart" }] },
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md", "lg", "xl"] },
    { key: "align", label: "Hizalama", default: "center", options: [{ value: "start", label: "başa" }, { value: "center", label: "ortaya" }, { value: "end", label: "sona" }] },
    { key: "order", label: "Sıra", default: "value", options: [{ value: "value", label: "önce değer" }, { value: "label", label: "önce etiket" }] },
    { key: "color", label: "Değer rengi", default: "", options: [{ value: "", label: "metin rengi" }, { value: "primary", label: "vurgu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-orange", label: "turuncu" }, { value: "success", label: "yeşil" }], prop: "m:color" },
    { key: "hint", label: "Alt not", default: false },
    { key: "clickable", label: "Tıklanabilir (düğme)", default: true },
    { key: "counter", label: "Değer: dönen sayaç", default: true },
  ],
});
