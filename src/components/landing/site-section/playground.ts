import { definePlayground } from "../../meta.ts";

interface Values { tone: string; align: string; width: string }

export default definePlayground<Values>({
  options: [
    { key: "tone", label: "Ton", default: "muted", options: [{ value: "plain", label: "düz" }, { value: "muted", label: "soluk" }, { value: "brand", label: "marka" }, { value: "inverse", label: "ters" }] },
    { key: "align", label: "Başlık hizası", default: "center", options: [{ value: "center", label: "orta" }, { value: "start", label: "baş" }] },
    { key: "width", label: "Genişlik", default: "default", options: [{ value: "narrow", label: "dar" }, { value: "default", label: "normal" }, { value: "wide", label: "geniş" }] },
  ],
});
