import { definePlayground } from "../../meta.ts";

interface Values { watch: boolean; scope: boolean; stack: boolean; breakpoints: boolean; output: boolean; timeline: boolean; options: boolean; depth: number; side: boolean; outputLines: number; ownLabels: boolean; ownIcons: boolean }

export default definePlayground<Values>({
  options: [
    { key: "watch", label: "İzlenenler bölümü", default: true },
    { key: "scope", label: "Kapsam bölümü", default: true },
    { key: "stack", label: "Çağrı yığını bölümü", default: true },
    { key: "breakpoints", label: "Kesme noktaları bölümü", default: true },
    { key: "output", label: "Çıktı bölümü", default: true },
    { key: "timeline", label: "Zaman çizelgesi", default: true },
    { key: "options", label: "Anahtarlar (hatada dur…)", default: true },
    { key: "side", label: "Bölümler yan yana (sürüklenen ayırıcı)", default: true },
    { key: "outputLines", label: "Çıktı satırı", default: 4, options: [{ value: 2, label: "2" }, { value: 4, label: "4" }, { value: 8, label: "8" }], visibleWhen: (v) => v.output },
    { key: "depth", label: "Değerlerin açık derinliği", default: 0, options: [{ value: 0, label: "kapalı" }, { value: 1, label: "1" }, { value: 2, label: "2" }] },
    { key: "ownLabels", label: "Kendi metinlerim", default: false },
    { key: "ownIcons", label: "Kendi ikonlarım", default: false },
  ],
});
