import { definePlayground } from "../../meta.ts";

interface Values { transition: string; presenter: boolean; progress: string; counter: string; controls: boolean }

export default definePlayground<Values>({
  options: [
    { key: "transition", label: "Geçiş", default: "slide", options: [{ value: "slide", label: "kaydır" }, { value: "fade", label: "sol" }, { value: "zoom", label: "yakınlaş" }, { value: "own", label: "kendi geçişim (dönerek)" }, { value: "none", label: "yok" }] },
    { key: "presenter", label: "Konuşmacı görünümü", default: false },
    { key: "progress", label: "İlerleme çizgisi", default: "gradient", options: [{ value: "gradient", label: "marka geçişi" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }, { value: "off", label: "yok" }] },
    { key: "controls", label: "Denetim çubuğu", default: true },
    { key: "counter", label: "Slayt sayacı", default: "on", options: [{ value: "on", label: "var" }, { value: "own", label: "kendi metnim (2 / 5)" }, { value: "off", label: "yok" }], visibleWhen: (v) => v.controls },
  ],
});
