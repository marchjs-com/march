import { definePlayground } from "../../meta.ts";

interface Values { size: string; footer: boolean; dismissable: boolean; long: boolean; closeButton: string; motion: string }

export default definePlayground<Values>({
  options: [
    { key: "size", label: "Boyut", default: "md", kind: "segmented", options: ["sm", "md", "lg", "full"] },
    { key: "footer", label: "Alt çubuk (düğmeler)", default: true },
    { key: "dismissable", label: "Escape ve perde kapatır", default: true },
    { key: "closeButton", label: "Kapat (×) düğmesi", default: "x", options: [{ value: "x", label: "×" }, { value: "own", label: "kendi ikonum (geri oku)" }, { value: "off", label: "yok" }], visibleWhen: (v) => v.dismissable },
    { key: "motion", label: "Giriş hareketi", default: "scale", options: [{ value: "scale", label: "büyüyerek" }, { value: "fade", label: "belirerek" }, { value: "rise", label: "yükselerek" }, { value: "none", label: "yok" }] },
    { key: "long", label: "Uzun içerik (kaydırma)", default: false },
  ],
});
