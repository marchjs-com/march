import { definePlayground } from "../../meta.ts";

interface Values { badges: boolean; disabled: boolean; motion: string; indicator: boolean }

export default definePlayground<Values>({
  options: [
    { key: "motion", label: "Panel hareketi", default: "default", options: [{ value: "default", label: "ilk açılışta yüksel" }, { value: "slide", label: "kay (yöne göre)" }, { value: "fade", label: "belir" }, { value: "rise", label: "yüksel (her geçişte)" }, { value: "own", label: "kendi hareketim (büyü)" }, { value: "none", label: "yok" }] },
    { key: "indicator", label: "Alt çizgi", default: true },
    { key: "badges", label: "Sayı rozeti", default: true },
    { key: "disabled", label: "Faturalama sekmesi devre dışı", default: true },
  ],
});
