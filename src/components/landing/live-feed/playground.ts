import { definePlayground } from "../../meta.ts";

interface Values { variant: string; enter: string; leave: string; glow: boolean; item: string; button: string; every: number; max: number }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Görünüm", default: "list", options: [{ value: "list", label: "satırlar" }, { value: "wall", label: "duvar" }] },
    { key: "enter", label: "Geliş", default: "flip", options: [{ value: "flip", label: "3B dönüş" }, { value: "slide", label: "kayma" }, { value: "fade", label: "solma" }, { value: "pop", label: "patlama" }, { value: "drop", label: "düşüp sekme" }, { value: "zoom", label: "önden gelme" }, { value: "blur", label: "netleşme" }, { value: "swing", label: "sallanma" }, { value: "unfold", label: "perde" }, { value: "glide", label: "yandan süzülme" }, { value: "spin", label: "dönerek" }, { value: "none", label: "yok" }] },
    { key: "leave", label: "Gidiş", default: "blur", options: [{ value: "blur", label: "bulanıklaşma" }, { value: "fade", label: "solma" }, { value: "shrink", label: "küçülme" }, { value: "fall", label: "düşme" }, { value: "slide", label: "kayma" }, { value: "dissolve", label: "ışığa karışma" }, { value: "fold", label: "katlanma" }, { value: "none", label: "yok" }] },
    { key: "glow", label: "Parıltı halkası", default: true },
    { key: "item", label: "Satır içeriği", default: "default", options: [{ value: "default", label: "hazır" }, { value: "own", label: "kendi çizimim" }] },
    { key: "button", label: "Durdur düğmesi", default: "default", options: [{ value: "default", label: "hazır metin" }, { value: "own", label: "kendi metnim" }, { value: "off", label: "yok" }] },
    { key: "every", label: "Aralık (ms)", default: 2400, min: 800, max: 6000, step: 200 },
    { key: "max", label: "Ekranda", default: 5, min: 2, max: 9, step: 1 },
  ],
});
