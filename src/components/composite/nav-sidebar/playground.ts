import { definePlayground } from "../../meta.ts";

export default definePlayground<{ groupOrder: string; defaultOpen: string; collapsible: boolean; recent: number; search: boolean; headings: boolean; expandAll: boolean; groupCounts: boolean; groupHeads: boolean; ownLabels: boolean; floating: boolean; glass: boolean; subMenus: string; pinCurrent: boolean; section: string; itemSize: string; subOverflow: string }>({
  options: [
    { key: "groupOrder", label: "Kategori sırası", default: "given", options: [{ value: "given", label: "Verilen" }, { value: "alpha", label: "Alfabetik" }] },
    { key: "defaultOpen", label: "İlk açılışta", default: "all", options: [{ value: "all", label: "Hepsi açık" }, { value: "active", label: "Yalnız etkin" }, { value: "none", label: "Kapalı" }] },
    { key: "section", label: "Listelenen kategoriler", default: "all", options: [{ value: "all", label: "Hepsi" }, { value: "sales", label: "Yalnız Satış" }, { value: "admin", label: "Yönetim + Analiz" }] },
    { key: "itemSize", label: "Satır boyu", default: "md", options: [{ value: "md", label: "sıkı" }, { value: "lg", label: "ferah (eşit yükseklik)" }] },
    { key: "subOverflow", label: "Sığmayan açıklama", default: "scroll", options: [{ value: "scroll", label: "duraklayarak kayar" }, { value: "marquee", label: "kesintisiz akar" }, { value: "ellipsis", label: "kesilir" }] },
    { key: "floating", label: "Yüzen kart", default: false },
    { key: "glass", label: "Buzlu cam", default: false },
    { key: "subMenus", label: "Alt sayfalar", default: "inline", options: [{ value: "inline", label: "listede açılır" }, { value: "flyout", label: "yanda yüzer (üzerine gelince)" }] },
    { key: "pinCurrent", label: "Geçerli dal listede iğneli", default: false },
    { key: "collapsible", label: "Daraltılabilir", default: true },
    { key: "recent", label: "Son kullanılanlar", default: 3, min: 0, max: 5, step: 1 },
    { key: "search", label: "Arama kutusu", default: true },
    { key: "headings", label: "Bölüm başlıkları", default: true },
    { key: "expandAll", label: "“Tümünü aç / kapat” düğmesi", default: true, visibleWhen: (v) => v.headings },
    { key: "groupHeads", label: "Kategori satırları", default: true },
    { key: "groupCounts", label: "Kategori sayıları", default: true },
    { key: "ownLabels", label: "Kendi metinlerim", default: false, visibleWhen: (v) => v.headings },
  ],
});
