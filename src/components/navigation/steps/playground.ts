import { definePlayground } from "../../meta.ts";

interface Values { vertical: boolean; clickable: boolean; color: string; done: string; connector: boolean }

export default definePlayground<Values>({
  options: [
    { key: "clickable", label: "Adımlar tıklanabilir", default: true },
    { key: "vertical", label: "Dikey", default: false },
    { key: "done", label: "Biten adım işareti", default: "check", options: [{ value: "check", label: "onay imi" }, { value: "star", label: "kendi ikonum (yıldız)" }, { value: "number", label: "numara kalsın" }, { value: "own", label: "kendi içeriğim" }] },
    { key: "connector", label: "Bağlantı çizgisi", default: true },
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "tema" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }], prop: "m:color" },
  ],
});
