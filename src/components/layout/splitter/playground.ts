import { definePlayground } from "../../meta.ts";

interface Values { initial: number; min: number; handle: string; color: string }

export default definePlayground<Values>({
  options: [
    { key: "initial", label: "Başlangıç payı", default: 35, min: 20, max: 80, step: 5, unit: "%" },
    { key: "min", label: "En küçük pay", default: 20, min: 5, max: 40, step: 5, unit: "%" },
    { key: "handle", label: "Tutamaç", default: "line", options: [{ value: "line", label: "çizgi" }, { value: "grip", label: "kendi tutamacım" }, { value: "off", label: "yok (sabit)" }] },
    { key: "color", label: "Tutamaç rengi", default: "primary", options: [{ value: "primary", label: "vurgu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-purple", label: "mor" }, { value: "success", label: "yeşil" }], visibleWhen: (v) => v.handle !== "off", prop: "m:color" },
  ],
});
