import { definePlayground } from "../../meta.ts";

interface Values { data: string; schema: boolean; search: boolean; expand: number; readonly: boolean; status: boolean; typeBadges: boolean; actions: string; ownLabels: boolean }

export default definePlayground<Values>({
  options: [
    { key: "data", label: "Veri", default: "config", kind: "segmented", options: [{ value: "config", label: "ayarlar" }, { value: "order", label: "sipariş" }, { value: "list", label: "liste" }] },
    { key: "schema", label: "Şema doğrulaması", default: true },
    { key: "search", label: "Arama kutusu", default: true },
    // 3 opens the deepest container of the sample data: a higher level would change nothing
    { key: "expand", label: "Açık seviye", default: 2, min: 0, max: 3, step: 1 },
    { key: "readonly", label: "Salt okunur", default: false },
    { key: "status", label: "Durum yazısı (Geçerli / N sorun)", default: true },
    { key: "typeBadges", label: "Tür rozetleri", default: true },
    { key: "actions", label: "Satır eylemleri", default: "all", options: [{ value: "all", label: "hepsi" }, { value: "add", label: "yalnız ekle" }, { value: "none", label: "yok" }], visibleWhen: (v) => !v.readonly },
    { key: "ownLabels", label: "Kendi metinlerim", default: false },
  ],
});
