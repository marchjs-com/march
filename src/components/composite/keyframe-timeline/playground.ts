import { definePlayground } from "../../meta.ts";

interface Values { scene: string; snap: number; loop: boolean; stage: boolean; readonly: boolean; transport: string; inspector: boolean; curves: boolean; labels: boolean }

export default definePlayground<Values>({
  options: [
    { key: "scene", label: "Sahne", default: "intro", kind: "segmented", options: [{ value: "intro", label: "giriş" }, { value: "bounce", label: "zıplama" }, { value: "orbit", label: "yörünge" }] },
    { key: "snap", label: "Yaslanma", default: 50, kind: "segmented", options: [{ value: 0, label: "yok" }, { value: 10, label: "10 ms" }, { value: 50, label: "50 ms" }, { value: 100, label: "100 ms" }] },
    { key: "loop", label: "Döngü", default: true },
    { key: "stage", label: "Önizleme sahnesi", default: true },
    { key: "transport", label: "Oynatma çubuğu", default: "all", kind: "segmented", options: [{ value: "all", label: "tümü" }, { value: "short", label: "oynat + süre" }, { value: "none", label: "yok" }] },
    { key: "curves", label: "İzlerde değer eğrisi", default: true },
    { key: "inspector", label: "Kare denetçisi", default: true },
    { key: "labels", label: "Kendi metinlerim (denetçi)", default: false, visibleWhen: (v) => v.inspector },
    { key: "readonly", label: "Salt okunur", default: false },
  ],
});
