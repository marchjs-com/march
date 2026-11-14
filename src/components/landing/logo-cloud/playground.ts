import { definePlayground } from "../../meta.ts";

interface Values { variant: string; mono: boolean; speed: number; reveal: string }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Görünüm", default: "marquee", options: [{ value: "grid", label: "ızgara" }, { value: "marquee", label: "kayan şerit" }] },
    { key: "mono", label: "Tek ton", default: true },
    { key: "speed", label: "Hız", default: 40, min: 10, max: 120, step: 10, unit: "px/sn", visibleWhen: (v) => v.variant === "marquee" },
    { key: "reveal", label: "Giriş hareketi", default: "fade", options: [{ value: "fade", label: "solma" }, { value: "up", label: "aşağıdan" }, { value: "scale", label: "büyüme" }, { value: "flip", label: "dönüş" }, { value: "none", label: "yok" }], visibleWhen: (v) => v.variant === "grid" },
  ],
});
