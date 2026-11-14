import { definePlayground } from "../../meta.ts";

interface Values { variant: string; heart: string; text: string }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Görünüm", default: "text", options: [{ value: "text", label: "metin" }, { value: "badge", label: "rozet" }, { value: "small", label: "küçük" }] },
    { key: "heart", label: "Kalp", default: "on", options: [{ value: "on", label: "💗" }, { value: "own", label: "kendi işaretim (☕)" }, { value: "off", label: "yok" }] },
    { key: "text", label: "Cümle", default: "default", options: [{ value: "default", label: "hazır" }, { value: "own", label: "kendi cümlem" }] },
  ],
});
