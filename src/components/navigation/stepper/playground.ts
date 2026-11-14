import { definePlayground } from "../../meta.ts";

interface Values { vertical: boolean; morph: boolean; color: string; highlight: boolean; counter: string; done: string }

export default definePlayground<Values>({
  options: [
    { key: "morph", label: "Morph geçişi", default: true },
    { key: "highlight", label: "Sıvı vurgu", default: true },
    { key: "counter", label: "Sayaç", default: "on", options: [{ value: "on", label: "2 / 4" }, { value: "own", label: "kendi metnim" }, { value: "off", label: "yok" }] },
    { key: "done", label: "Biten adım işareti", default: "check", options: [{ value: "check", label: "onay imi" }, { value: "number", label: "numara kalsın" }] },
    { key: "vertical", label: "Dikey", default: false },
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "tema" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }] },
  ],
});
