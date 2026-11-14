import { definePlayground } from "../../meta.ts";

interface Values { visible: boolean; help: string; politeness: string; as: string }

export default definePlayground<Values>({
  options: [
    { key: "visible", label: "Görünür metin", default: true },
    { key: "help", label: "Yardım satırı", default: "text", options: [{ value: "off", label: "yok" }, { value: "text", label: "metin" }, { value: "own", label: "kendi düğümüm" }] },
    { key: "politeness", label: "Okuma", default: "polite", options: [{ value: "polite", label: "sırasını bekler" }, { value: "assertive", label: "araya girer" }] },
    { key: "as", label: "Öğe", default: "span", options: ["span", "div", "p"], visibleWhen: (v) => v.visible },
  ],
});
