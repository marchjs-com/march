import { definePlayground } from "../../meta.ts";

interface Values { tones: boolean; icons: boolean; time: string }

export default definePlayground<Values>({
  options: [
    { key: "tones", label: "Tonlu noktalar", default: true },
    { key: "icons", label: "İkon", default: false },
    { key: "time", label: "Zaman", default: "text", options: [{ value: "text", label: "metin" }, { value: "date", label: "tarih (biçimlenir)" }, { value: "none", label: "yok" }] },
  ],
});
