import { definePlayground } from "../../meta.ts";

interface Values { direction: string; radius: number; border: boolean; dividers: boolean }

export default definePlayground<Values>({
  options: [
    { key: "direction", label: "Yön", default: "vertical", options: [{ value: "vertical", label: "dikey" }, { value: "horizontal", label: "yatay" }] },
    { key: "radius", label: "Köşe", default: 2, min: 0, max: 4, step: 1 },
    { key: "border", label: "Çerçeve", default: true, toCode: { true: null, false: "{false}" } },
    { key: "dividers", label: "Aradaki çizgi", default: true, toCode: { true: null, false: "{false}" } },
  ],
});
