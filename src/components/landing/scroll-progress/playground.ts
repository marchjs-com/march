import { definePlayground } from "../../meta.ts";

interface Values { paint: string; size: number }

export default definePlayground<Values>({
  options: [
    { key: "paint", label: "Boya", default: "gradient", options: [{ value: "gradient", label: "gradyan" }, { value: "accent", label: "vurgu" }] },
    { key: "size", label: "Kalınlık", default: 6, min: 2, max: 12, step: 1, unit: "px" },
  ],
});
