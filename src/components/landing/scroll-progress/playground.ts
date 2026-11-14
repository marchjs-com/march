import { definePlayground } from "../../meta.ts";

interface Values { paint: string; size: number; color: string }

export default definePlayground<Values>({
  options: [
    { key: "paint", label: "Boya", default: "gradient", options: [{ value: "gradient", label: "gradyan" }, { value: "accent", label: "vurgu" }] },
    { key: "color", label: "Renk", default: "default", options: [{ value: "default", label: "boyaya göre" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }, { value: "success", label: "yeşil" }] },
    { key: "size", label: "Kalınlık", default: 6, min: 2, max: 12, step: 1, unit: "px" },
  ],
});
