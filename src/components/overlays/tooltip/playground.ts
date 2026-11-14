import { definePlayground } from "../../meta.ts";

interface Values { target: string; color: string; delay: number; motion: string }

export default definePlayground<Values>({
  options: [
    { key: "target", label: "Neye ipucu", default: "button", options: [{ value: "button", label: "metinli düğme" }, { value: "icon", label: "ikon düğmesi" }] },
    { key: "color", label: "Balon rengi", default: "", options: [{ value: "", label: "ters yüzey" }, { value: "primary", label: "tema" }, { value: "success", label: "başarı" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }] },
    { key: "delay", label: "Gecikme (üstüne gelince)", default: 300, kind: "segmented", options: [{ value: 0, label: "yok" }, { value: 300, label: "0,3 sn" }, { value: 1000, label: "1 sn" }] },
    { key: "motion", label: "Giriş hareketi", default: "scale", options: [{ value: "scale", label: "büyüyerek" }, { value: "fade", label: "belirerek" }, { value: "none", label: "yok" }] },
  ],
});
