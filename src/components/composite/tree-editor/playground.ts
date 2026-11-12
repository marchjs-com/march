import { definePlayground } from "../../meta.ts";

interface Values { data: string; schema: boolean; search: boolean; expand: number; readonly: boolean }

export default definePlayground<Values>({
  options: [
    { key: "data", label: "Veri", default: "config", kind: "segmented", options: [{ value: "config", label: "ayarlar" }, { value: "order", label: "sipariş" }, { value: "list", label: "liste" }] },
    { key: "schema", label: "Şema doğrulaması", default: true },
    { key: "search", label: "Arama kutusu", default: true },
    { key: "expand", label: "Açık seviye", default: 2, min: 0, max: 4, step: 1 },
    { key: "readonly", label: "Salt okunur", default: false },
  ],
});
