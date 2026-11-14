import { definePlayground } from "../../meta.ts";

interface Values { trigger: string; mode: string; speed: number; disabled: boolean; ticker: boolean; separator: string }

export default definePlayground<Values>({
  options: [
    { key: "trigger", label: "Tetik", default: "hover", options: ["hover", "focus", "always", "visible"] },
    { key: "mode", label: "Mod", default: "bounce", options: ["bounce", "loop", "once"] },
    { key: "speed", label: "Hız", default: 40, min: 10, max: 120, step: 10, unit: "px/s" },
    { key: "disabled", label: "Kaydırma kapalı", default: false },
    { key: "ticker", label: "Marquee şeridi", default: true },
    { key: "separator", label: "Şerit ayracı", default: "star", kind: "segmented", options: [{ value: "star", label: "✦" }, { value: "icon", label: "kendi ikonum" }, { value: "off", label: "yok" }], visibleWhen: (v) => v.ticker },
  ],
});
