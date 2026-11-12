import { definePlayground } from "../../meta.ts";

interface Values { threshold: number; delay: number; disabled: boolean }

export default definePlayground<Values>({
  options: [
    { key: "threshold", label: "Eşik", default: 72, min: 40, max: 140, step: 4, unit: "px" },
    { key: "delay", label: "Yenileme süresi", default: 1200, min: 200, max: 4000, step: 100, unit: "ms" },
    { key: "disabled", label: "Kapalı", default: false },
  ],
});
