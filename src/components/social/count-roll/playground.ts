import { definePlayground } from "../../meta.ts";

interface Values { format: string; step: number; roll: boolean; duration: number }

export default definePlayground<Values>({
  options: [
    { key: "format", label: "Biçim", default: "full", options: [{ value: "compact", label: "kısa (1,2 B)" }, { value: "full", label: "tam (1.234)" }, { value: "own", label: "kendi metnim (1234 beğeni)" }] },
    { key: "step", label: "Adım", default: 1, options: [{ value: 1, label: "+1" }, { value: 9, label: "+9" }, { value: 250, label: "+250" }] },
    { key: "roll", label: "Yuvarlanma", default: true },
    { key: "duration", label: "Yuvarlanma süresi", default: 320, options: [{ value: 160, label: "hızlı" }, { value: 320, label: "normal" }, { value: 900, label: "yavaş" }], visibleWhen: (v) => v.roll },
  ],
});
