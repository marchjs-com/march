import { definePlayground } from "../../meta.ts";

interface Values { rows: string; group: string; density: string; selectable: boolean; pinned: boolean; footer: boolean; toolbar: string; columnMenu: boolean; labels: boolean; animate: boolean }

export default definePlayground<Values>({
  options: [
    { key: "rows", label: "Satır", default: "100000", options: [{ value: "1000", label: "1 bin" }, { value: "10000", label: "10 bin" }, { value: "100000", label: "100 bin" }] },
    { key: "group", label: "Grupla", default: "", options: [{ value: "", label: "yok" }, { value: "region", label: "bölge" }, { value: "region,status", label: "bölge › durum" }] },
    { key: "density", label: "Yoğunluk", default: "36", options: [{ value: "30", label: "sıkı" }, { value: "36", label: "normal" }, { value: "44", label: "rahat" }] },
    { key: "selectable", label: "Satır seçimi", default: true },
    { key: "pinned", label: "Müşteri sütunu sabit", default: true },
    { key: "footer", label: "Toplam satırı", default: true },
    { key: "toolbar", label: "Araç çubuğu", default: "full", options: [{ value: "full", label: "tam" }, { value: "lean", label: "yalnız arama + sayı" }, { value: "off", label: "yok" }] },
    { key: "columnMenu", label: "Sütun menüsü (⋮)", default: true },
    { key: "labels", label: "Kendi metinlerim (sipariş)", default: false },
    { key: "animate", label: "Hareket", default: true },
  ],
});
