import { definePlayground } from "../../meta.ts";

interface Values { mode: string; shrink: boolean; hide: boolean; pill: string }

export default definePlayground<Values>({
  options: [
    { key: "mode", label: "Görünüm", default: "floating", options: [{ value: "solid", label: "dolu" }, { value: "transparent", label: "saydam → cam" }, { value: "floating", label: "yüzen hap" }] },
    { key: "shrink", label: "Kaydırınca küçül", default: true },
    { key: "hide", label: "Aşağı kaydırırken gizlen", default: false },
    { key: "pill", label: "Bağlantı altındaki hap", default: "on", options: [{ value: "on", label: "var" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }, { value: "off", label: "yok" }] },
  ],
});
