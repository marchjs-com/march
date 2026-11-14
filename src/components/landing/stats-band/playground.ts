import { definePlayground } from "../../meta.ts";

interface Values { variant: string; mode: string; color: string; reveal: string }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Görünüm", default: "divided", options: [{ value: "plain", label: "sade" }, { value: "divided", label: "çizgili" }, { value: "cards", label: "kartlar" }] },
    { key: "mode", label: "Sayaç", default: "count", options: [{ value: "count", label: "sayma" }, { value: "roll", label: "odometre" }, { value: "none", label: "yok (düz sayı)" }] },
    { key: "color", label: "Sayı rengi", default: "default", options: [{ value: "default", label: "metin rengi" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }, { value: "brand-green", label: "yeşil" }], prop: "m:color" },
    { key: "reveal", label: "Giriş hareketi", default: "up", options: [{ value: "up", label: "yukarı" }, { value: "scale", label: "ölçek" }, { value: "flip", label: "çevirme" }, { value: "off", label: "yok" }] },
  ],
});
