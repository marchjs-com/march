import { definePlayground } from "../../meta.ts";

interface Values { threshold: number }

export default definePlayground<Values>({
  options: [
    { key: "threshold", label: "Belirme eşiği", default: 120, min: 40, max: 400, step: 20, unit: "px" },
  ],
});
