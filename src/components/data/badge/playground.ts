import { definePlayground } from "../../meta.ts";

interface Values { mode: string; tone: string; size: string; dot: string; pulse: string; clickable: boolean; count: number; showZero: boolean; format: string }

export default definePlayground<Values>({
  options: [
    { key: "mode", label: "Tür", default: "label", options: [{ value: "label", label: "etiket" }, { value: "dot", label: "noktalı" }, { value: "count", label: "sayı" }] },
    { key: "tone", label: "Ton", default: "success", options: ["neutral", "primary", "info", "success", "warn", "danger"] },
    { key: "size", label: "Boyut", default: "md", kind: "segmented", options: [{ value: "md", label: "md" }, { value: "xs", label: "xs (köşe rozeti)" }] },
    { key: "dot", label: "Nokta", default: "tone", options: [{ value: "tone", label: "ton rengi" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }, { value: "own", label: "kendi işaretim" }], visibleWhen: (v) => v.mode === "dot" },
    { key: "pulse", label: "Nokta hareketi", default: "off", kind: "segmented", options: [{ value: "off", label: "durgun" }, { value: "ring", label: "halka" }, { value: "blink", label: "yanıp sönme" }], visibleWhen: (v) => v.mode === "dot" && v.dot !== "own" },
    { key: "clickable", label: "Tıklanır (düğme olarak çizilir)", default: false },
    { key: "count", label: "Sayı", default: 7, min: 0, max: 150, visibleWhen: (v) => v.mode === "count" },
    { key: "format", label: "Sayı metni", default: "cap", options: [{ value: "cap", label: "99+" }, { value: "own", label: "kendi metnim (7 yeni)" }], visibleWhen: (v) => v.mode === "count" && v.count > 0 },
    { key: "showZero", label: "0 iken göster", default: false, visibleWhen: (v) => v.mode === "count" && v.count === 0 },
  ],
});
