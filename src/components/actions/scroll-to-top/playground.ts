import { definePlayground } from "../../meta.ts";

interface Values { threshold: number; motion: string; icon: string; color: string }

export default definePlayground<Values>({
  options: [
    { key: "threshold", label: "Belirme eşiği", default: 120, min: 40, max: 400, step: 20, unit: "px" },
    { key: "motion", label: "Belirme hareketi", default: "pop", options: [{ value: "pop", label: "zıplayarak" }, { value: "fade", label: "belirerek" }, { value: "slide", label: "kayarak" }, { value: "own", label: "kendi hareketim (dönerek)" }, { value: "none", label: "yok" }] },
    { key: "icon", label: "İkon", default: "arrow", options: [{ value: "arrow", label: "ok" }, { value: "chevron", label: "köşeli ok" }, { value: "text", label: "kendi metnim" }] },
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "tema" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }] },
  ],
});
