import { definePlayground } from "../../meta.ts";

interface Values { tones: boolean; icons: boolean; time: string; dot: string; line: boolean }

export default definePlayground<Values>({
  options: [
    { key: "dot", label: "Nokta", default: "on", options: [{ value: "on", label: "var" }, { value: "brand", label: "marka renkleri" }, { value: "number", label: "sıra numarası" }, { value: "off", label: "yok" }] },
    { key: "tones", label: "Tonlu noktalar", default: true, visibleWhen: (v) => v.dot === "on" },
    { key: "icons", label: "İkon", default: false, visibleWhen: (v) => v.dot === "on" || v.dot === "brand" },
    { key: "line", label: "Bağlantı çizgisi", default: true },
    { key: "time", label: "Zaman", default: "text", options: [{ value: "text", label: "metin" }, { value: "date", label: "tarih (biçimlenir)" }, { value: "own", label: "kendi biçimim (saat)" }, { value: "none", label: "yok" }] },
  ],
});
