import { definePlayground } from "../../meta.ts";

interface Values { layout: string; search: boolean; multiple: boolean; texts: boolean; count: boolean; reveal: string }

export default definePlayground<Values>({
  options: [
    { key: "layout", label: "Düzen", default: "split", options: [{ value: "center", label: "ortada" }, { value: "split", label: "iki sütun" }] },
    { key: "search", label: "Arama", default: true },
    { key: "multiple", label: "Birden çok açık", default: false },
    { key: "count", label: "Eşleşme sayısı satırı", default: true, visibleWhen: (v) => v.search },
    { key: "texts", label: "Kendi arama metinlerim", default: false, visibleWhen: (v) => v.search },
    { key: "reveal", label: "Başlık girişi", default: "up", options: [{ value: "up", label: "aşağıdan" }, { value: "start", label: "yandan" }, { value: "blur", label: "netleşme" }, { value: "none", label: "yok" }], visibleWhen: (v) => v.layout === "split" },
  ],
});
