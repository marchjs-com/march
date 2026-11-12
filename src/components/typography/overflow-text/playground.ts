import { definePlayground } from "../../meta.ts";

interface Values { trigger: string; mode: string; speed: number; ticker: boolean }

export default definePlayground<Values>({
  options: [
    { key: "trigger", label: "Tetik", default: "hover", options: ["hover", "focus", "always", "visible"] },
    { key: "mode", label: "Mod", default: "bounce", options: ["bounce", "loop", "once"] },
    { key: "speed", label: "Hız", default: 40, min: 10, max: 120, step: 10, unit: "px/s" },
    { key: "ticker", label: "Marquee şeridi", default: true },
  ],
});
