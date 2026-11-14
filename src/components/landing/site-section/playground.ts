import { definePlayground } from "../../meta.ts";

interface Values { tone: string; align: string; width: string; color: string; reveal: string }

export default definePlayground<Values>({
  options: [
    { key: "tone", label: "Ton", default: "muted", options: [{ value: "plain", label: "düz" }, { value: "muted", label: "soluk" }, { value: "brand", label: "marka" }, { value: "inverse", label: "ters" }] },
    { key: "align", label: "Başlık hizası", default: "center", options: [{ value: "center", label: "orta" }, { value: "start", label: "baş" }] },
    { key: "color", label: "Renk (üst yazı ve marka tonu)", default: "default", options: [{ value: "default", label: "vurgu rengi" }, { value: "brand-purple", label: "mor" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-green", label: "yeşil" }] },
    { key: "reveal", label: "Başlık girişi", default: "up", options: [{ value: "up", label: "yukarı" }, { value: "blur", label: "bulanık" }, { value: "flip", label: "çevirme" }, { value: "off", label: "yok" }] },
    { key: "width", label: "Genişlik", default: "default", options: [{ value: "narrow", label: "dar" }, { value: "default", label: "normal" }, { value: "wide", label: "geniş" }] },
  ],
});
