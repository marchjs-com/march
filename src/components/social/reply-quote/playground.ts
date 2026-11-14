import { definePlayground } from "../../meta.ts";

interface Values { place: string; lines: number; color: string; bar: boolean; close: string; click: boolean }

export default definePlayground<Values>({
  options: [
    { key: "place", label: "Yer", default: "field", options: [{ value: "field", label: "mesaj alanının üstü" }, { value: "bubble", label: "renkli balonun içi (inverse)" }] },
    { key: "lines", label: "Metin satırı (0: tümü)", default: 2, min: 0, max: 4, step: 1 },
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "turuncu (hazır)" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }], visibleWhen: (v) => v.place === "field" },
    { key: "bar", label: "Kenar çubuğu", default: true },
    { key: "close", label: "Vazgeç düğmesi", default: "on", options: [{ value: "on", label: "hazır" }, { value: "own", label: "kendi ikonum" }, { value: "off", label: "yok" }], visibleWhen: (v) => v.place === "field" },
    { key: "click", label: "Tıklanır (alıntılanan mesaja git)", default: false },
  ],
});
