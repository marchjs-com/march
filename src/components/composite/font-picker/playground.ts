import { definePlayground } from "../../meta.ts";

export interface Values {
  view: string; preview: string; category: string; sort: string; source: string; askConsent: boolean; search: boolean; categories: boolean; sorts: boolean; subsets: boolean;
  favorites: boolean; recent: boolean; specimen: boolean; sizeControl: boolean; styleControls: boolean; css: boolean; meta: boolean; count: boolean; closeOnPick: boolean; disabled: boolean;
}

export default definePlayground<Values>({
  options: [
    { key: "view", label: "Görünüm", default: "popover", kind: "segmented", options: [{ value: "popover", label: "Açılır panel" }, { value: "dialog", label: "Diyalog" }, { value: "inline", label: "Satır içi" }] },
    { key: "preview", label: "Satırda", default: "name", kind: "segmented", options: [{ value: "name", label: "Ad" }, { value: "sample", label: "Örnek metin" }] },
    { key: "category", label: "Tür", default: "all", kind: "chips", options: [{ value: "all", label: "Tümü" }, { value: "sans-serif", label: "Sans" }, { value: "serif", label: "Serif" }, { value: "display", label: "Dekoratif" }, { value: "handwriting", label: "El yazısı" }, { value: "monospace", label: "Mono" }] },
    { key: "sort", label: "Sıralama", default: "popular", kind: "segmented", options: [{ value: "popular", label: "Popüler" }, { value: "name", label: "A–Z" }, { value: "newest", label: "Yeni" }] },
    { key: "source", label: "Web yazı tipleri", default: "google", kind: "segmented", options: [{ value: "google", label: "Google Fonts" }, { value: "off", label: "Yükleme" }, { value: "none", label: "Yalnız sistem" }] },
    { key: "askConsent", label: "Yüklemeden önce izin sor", default: true, visibleWhen: (v) => v.source === "google" },
    { key: "search", label: "Arama", default: true },
    { key: "categories", label: "Tür seçici", default: true },
    { key: "sorts", label: "Sıralama seçici", default: true },
    { key: "subsets", label: "Alfabe listesi", default: true, visibleWhen: (v) => v.source !== "none" },
    { key: "favorites", label: "Favoriler", default: true },
    { key: "recent", label: "Son kullanılanlar", default: true },
    { key: "meta", label: "Satırda tür ve stil sayısı", default: true },
    { key: "count", label: "Eşleşme sayısı", default: true },
    { key: "specimen", label: "Örnek alanı", default: true },
    { key: "sizeControl", label: "Boyut kaydırıcısı", default: true, visibleWhen: (v) => v.specimen },
    { key: "styleControls", label: "Kalınlık ve italik", default: true, visibleWhen: (v) => v.specimen },
    { key: "css", label: "CSS satırı", default: true, visibleWhen: (v) => v.specimen },
    { key: "closeOnPick", label: "Seçince kapat", default: false, visibleWhen: (v) => v.view !== "inline" },
    { key: "disabled", label: "Devre dışı", default: false },
  ],
});
