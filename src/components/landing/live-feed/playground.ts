import { definePlayground } from "../../meta.ts";

interface Values { variant: string; enter: string; leave: string; glow: boolean; every: number; max: number }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Görünüm", default: "list", options: [{ value: "list", label: "satırlar" }, { value: "wall", label: "duvar" }] },
    { key: "enter", label: "Geliş", default: "flip", options: [{ value: "flip", label: "3B dönüş" }, { value: "slide", label: "kayma" }, { value: "fade", label: "solma" }, { value: "pop", label: "patlama" }, { value: "drop", label: "düşüp sekme" }, { value: "zoom", label: "önden gelme" }, { value: "blur", label: "netleşme" }, { value: "swing", label: "sallanma" }, { value: "unfold", label: "perde" }, { value: "glide", label: "yandan süzülme" }, { value: "spin", label: "dönerek" }] },
    { key: "leave", label: "Gidiş", default: "blur", options: [{ value: "blur", label: "bulanıklaşma" }, { value: "fade", label: "solma" }, { value: "shrink", label: "küçülme" }, { value: "fall", label: "düşme" }, { value: "slide", label: "kayma" }, { value: "dissolve", label: "ışığa karışma" }, { value: "fold", label: "katlanma" }] },
    { key: "glow", label: "Parıltı halkası", default: true },
    { key: "every", label: "Aralık (ms)", default: 2400, min: 800, max: 6000, step: 200 },
    { key: "max", label: "Ekranda", default: 5, min: 2, max: 9, step: 1 },
  ],
});
