import { definePlayground } from "../../meta.ts";

interface Values { size: string; shape: string; content: string; color: string; broken: boolean }

export default definePlayground<Values>({
  stage: "center",
  code: { props: { name: '"Elif Arslan"' } },
  options: [
    { key: "size", label: "Boyut", default: "md", options: ["xs", "sm", "md", "lg", "xl"] },
    { key: "shape", label: "Biçim", default: "circle", options: [{ value: "circle", label: "daire" }, { value: "square", label: "kare" }] },
    { key: "content", label: "Resim yokken", default: "initials", options: [{ value: "initials", label: "baş harfler" }, { value: "text", label: "hazır metin" }, { value: "icon", label: "ikon" }],
      toCode: { initials: { text: null, icon: null }, text: { text: '"?"', icon: null }, icon: { text: null, icon: "{user}" } } },
    { key: "color", label: "Renk", default: "name", options: [{ value: "name", label: "addan" }, { value: "primary", label: "ana renk" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }, { value: "neutral", label: "nötr" }], toCode: { name: null } },
    { key: "broken", label: "Bozuk resim adresi", default: false, prop: "src", toCode: { false: "{photo}", true: '"/olmayan.jpg"' } },
  ],
});
