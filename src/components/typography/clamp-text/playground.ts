import { definePlayground } from "../../meta.ts";

interface Values { lines: number; expandable: boolean; collapsible: boolean; labels: string; color: string; short: boolean }

export default definePlayground<Values>({
  options: [
    { key: "lines", label: "Satır", default: 3, min: 1, max: 6, step: 1 },
    { key: "expandable", label: "\"devamı\" düğmesi", default: true },
    { key: "collapsible", label: "Açılınca \"daha az\"", default: true, visibleWhen: (v) => v.expandable },
    { key: "labels", label: "Düğme metni", default: "default", options: [{ value: "default", label: "devamı / daha az" }, { value: "own", label: "kendi metnim" }], visibleWhen: (v) => v.expandable },
    { key: "color", label: "Düğme rengi", default: "primary", options: [{ value: "primary", label: "tema" }, { value: "brand-blue", label: "mavi" }, { value: "brand-purple", label: "mor" }, { value: "neutral", label: "nötr" }], visibleWhen: (v) => v.expandable , prop: "m:color"},
    { key: "short", label: "Kısa metin (sığar, düğme çıkmaz)", default: false },
  ],
});
