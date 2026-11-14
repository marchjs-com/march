import { definePlayground } from "../../meta.ts";

export default definePlayground<{ groupOrder: string; defaultOpen: string; collapsible: boolean; recent: number; search: boolean; headings: boolean; expandAll: boolean; groupCounts: boolean; ownLabels: boolean }>({
  options: [
    { key: "groupOrder", label: "Kategori sırası", default: "given", options: [{ value: "given", label: "Verilen" }, { value: "alpha", label: "Alfabetik" }] },
    { key: "defaultOpen", label: "İlk açılışta", default: "all", options: [{ value: "all", label: "Hepsi açık" }, { value: "active", label: "Yalnız etkin" }, { value: "none", label: "Kapalı" }] },
    { key: "collapsible", label: "Daraltılabilir", default: true },
    { key: "recent", label: "Son kullanılanlar", default: 3, min: 0, max: 5, step: 1 },
    { key: "search", label: "Arama kutusu", default: true },
    { key: "headings", label: "Bölüm başlıkları", default: true },
    { key: "expandAll", label: "“Tümünü aç / kapat” düğmesi", default: true, visibleWhen: (v) => v.headings },
    { key: "groupCounts", label: "Kategori sayıları", default: true },
    { key: "ownLabels", label: "Kendi metinlerim", default: false, visibleWhen: (v) => v.headings },
  ],
});
