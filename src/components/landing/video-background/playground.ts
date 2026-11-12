import { definePlayground } from "../../meta.ts";

interface Values { tint: string; tintOpacity: number; controls: boolean }

export default definePlayground<Values>({
  options: [
    { key: "tint", label: "Renk katmanı", default: "dark", options: [{ value: "dark", label: "koyu" }, { value: "light", label: "açık" }, { value: "brand", label: "marka" }, { value: "none", label: "yok" }] },
    { key: "tintOpacity", label: "Katman gücü", default: 0.6, min: 0.1, max: 1, step: 0.05, visibleWhen: (v) => v.tint !== "none" },
    { key: "controls", label: "Durdur düğmesi", default: true },
  ],
});
