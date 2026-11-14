import { definePlayground } from "../../meta.ts";

interface Values { columns: number; tones: boolean; dot: string; count: string; animate: boolean }

export default definePlayground<Values>({
  options: [
    { key: "columns", label: "Sütun", default: 3, options: [2, 3, 4] },
    { key: "dot", label: "Başlık noktası", default: "tone", options: [{ value: "tone", label: "ton" }, { value: "brand", label: "marka renkleri" }, { value: "own", label: "kendi ikonum" }, { value: "off", label: "yok" }] },
    { key: "tones", label: "Tonlu başlık", default: true, visibleWhen: (v) => v.dot === "tone" },
    { key: "count", label: "Sayaç", default: "on", options: [{ value: "on", label: "var" }, { value: "own", label: "kendi metnim" }, { value: "off", label: "yok" }] },
    { key: "animate", label: "Kart giriş hareketi", default: true },
  ],
});
