import { definePlayground } from "../../meta.ts";

/** The sample label of each tone (the demo draws it, the generated code writes it). */
export const LABEL: Record<string, string> = { neutral: "Taslak", primary: "Yeni", info: "Davetli", success: "Etkin", warn: "Bekliyor", danger: "Askıda" }

interface Values { mode: string; tone: string; size: string; dot: string; pulse: string; clickable: boolean; count: number; showZero: boolean; format: string }

export default definePlayground<Values>({
  stage: "center",
  code: { children: (v) => (v.mode === "count" ? null : LABEL[v.tone] ?? null) },
  options: [
    { key: "mode", label: "Tür", default: "label", options: [{ value: "label", label: "etiket" }, { value: "dot", label: "noktalı" }, { value: "count", label: "sayı" }], prop: false,
      fromCode: (a) => ("count" in a ? "count" : "dot" in a ? "dot" : "label") },
    { key: "tone", label: "Ton", default: "success", options: ["neutral", "primary", "info", "success", "warn", "danger"], toCode: (t) => (t === "neutral" ? null : JSON.stringify(t)) },
    { key: "size", label: "Boyut", default: "md", kind: "segmented", options: [{ value: "md", label: "md" }, { value: "xs", label: "xs (köşe rozeti)" }] },
    { key: "dot", label: "Nokta", default: "tone", options: [{ value: "tone", label: "ton rengi" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }, { value: "own", label: "kendi işaretim" }], visibleWhen: (v) => v.mode === "dot",
      toCode: { tone: { dot: "", dotColor: null }, "brand-orange": { dot: "", dotColor: '"brand-orange"' }, "brand-purple": { dot: "", dotColor: '"brand-purple"' }, own: { dot: "{<Icon of={heart} />}", dotColor: null } } },
    { key: "pulse", label: "Nokta hareketi", default: "off", kind: "segmented", options: [{ value: "off", label: "durgun" }, { value: "ring", label: "halka" }, { value: "blink", label: "yanıp sönme" }], visibleWhen: (v) => v.mode === "dot" && v.dot !== "own", toCode: { off: null } },
    { key: "clickable", label: "Tıklanır (düğme olarak çizilir)", default: false, toCode: { true: { onClick: "{toggle}", pressed: "{$on}" }, false: { onClick: null, pressed: null } } },
    { key: "count", label: "Sayı", default: 7, min: 0, max: 150, visibleWhen: (v) => v.mode === "count", toCode: (n) => `{${String(n)}}` },
    { key: "format", label: "Sayı metni", default: "cap", options: [{ value: "cap", label: "99+" }, { value: "own", label: "kendi metnim (7 yeni)" }], visibleWhen: (v) => v.mode === "count" && v.count > 0, toCode: { cap: null, own: "{(n) => `${n} yeni`}" } },
    { key: "showZero", label: "0 iken göster", default: false, visibleWhen: (v) => v.mode === "count" && v.count === 0 },
  ],
});
