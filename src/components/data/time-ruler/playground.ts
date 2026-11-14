import { definePlayground } from "../../meta.ts";

interface Values { duration: number; seekable: boolean; minor: boolean; major: string; head: string; color: string; format: string }

export default definePlayground<Values>({
  options: [
    { key: "duration", label: "Süre", default: 4000, min: 1000, max: 20000, step: 1000, unit: "ms" },
    { key: "seekable", label: "Sürüklenebilir (onSeek)", default: true },
    { key: "minor", label: "Ara tikler", default: true },
    { key: "major", label: "Etiket aralığı", default: "auto", options: [{ value: "auto", label: "otomatik" }, { value: "1000", label: "1 sn" }, { value: "2000", label: "2 sn" }] },
    { key: "head", label: "Oynatma başı", default: "on", options: [{ value: "on", label: "var" }, { value: "own", label: "kendi tutamacım" }, { value: "off", label: "yok" }] },
    { key: "color", label: "Renk", default: "primary", options: [{ value: "primary", label: "ana renk" }, { value: "brand-blue", label: "mavi" }, { value: "brand-purple", label: "mor" }] },
    { key: "format", label: "Etiket biçimi", default: "seconds", options: [{ value: "seconds", label: "1.5s" }, { value: "clock", label: "0:01" }] },
  ],
});
