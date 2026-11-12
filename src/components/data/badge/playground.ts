import { definePlayground } from "../../meta.ts";

interface Values { mode: string; tone: string; count: number; showZero: boolean }

export default definePlayground<Values>({
  options: [
    { key: "mode", label: "Tür", default: "label", options: [{ value: "label", label: "etiket" }, { value: "dot", label: "noktalı" }, { value: "count", label: "sayı" }] },
    { key: "tone", label: "Ton", default: "success", options: ["neutral", "primary", "info", "success", "warn", "danger"] },
    { key: "count", label: "Sayı", default: 7, min: 0, max: 150, visibleWhen: (v) => v.mode === "count" },
    { key: "showZero", label: "0 iken göster", default: false, visibleWhen: (v) => v.mode === "count" && v.count === 0 },
  ],
});
