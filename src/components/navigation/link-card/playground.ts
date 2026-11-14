import { definePlayground } from "../../meta.ts";

interface Values { lead: string; color: string; description: boolean; meta: boolean; arrow: string }

export default definePlayground<Values>({
  options: [
    { key: "lead", label: "Baş", default: "icon", options: [{ value: "icon", label: "ikon karosu" }, { value: "own", label: "kendi düğümüm (avatar)" }, { value: "off", label: "yok" }] },
    { key: "color", label: "Karo rengi", default: "tones", options: [{ value: "tones", label: "tonlar" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-purple", label: "mor" }], visibleWhen: (v) => v.lead === "icon" },
    { key: "description", label: "Açıklama", default: true },
    { key: "meta", label: "Sondaki metin", default: true },
    { key: "arrow", label: "Ok", default: "on", options: [{ value: "on", label: "var" }, { value: "own", label: "kendi işaretim" }, { value: "off", label: "yok" }] },
  ],
});
