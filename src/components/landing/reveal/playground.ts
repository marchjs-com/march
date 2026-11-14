import { definePlayground } from "../../meta.ts";

interface Values { effect: string; stagger: number; scrub: boolean }

export default definePlayground<Values>({
  options: [
    { key: "effect", label: "Efekt", default: "up", kind: "chips", options: [{ value: "fade", label: "solma" }, { value: "up", label: "yukarı" }, { value: "down", label: "aşağı" }, { value: "start", label: "baştan" }, { value: "end", label: "sondan" }, { value: "scale", label: "ölçek" }, { value: "blur", label: "bulanık" }, { value: "flip", label: "çevirme" }, { value: "own", label: "kendi karelerim (dönerek)" }, { value: "none", label: "yok" }] },
    { key: "stagger", label: "Ardışık gecikme", default: 80, min: 0, max: 240, step: 20, unit: "ms", visibleWhen: (v) => !v.scrub },
    { key: "scrub", label: "Kaydırmaya bağlı", default: false },
  ],
});
