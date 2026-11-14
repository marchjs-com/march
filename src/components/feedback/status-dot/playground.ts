import { definePlayground } from "../../meta.ts";

interface Values { tone: string; color: string; pulse: string; size: string; label: boolean }

export default definePlayground<Values>({
  options: [
    { key: "tone", label: "Ton", default: "success", options: [{ value: "success", label: "başarılı" }, { value: "info", label: "bilgi" }, { value: "warn", label: "uyarı" }, { value: "danger", label: "tehlike" }, { value: "primary", label: "vurgu" }, { value: "neutral", label: "nötr" }], visibleWhen: (v) => !v.color },
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "tondan" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-purple", label: "mor" }, { value: "cat-5", label: "kategori 5" }] },
    { key: "pulse", label: "Hareket", default: "ring", options: [{ value: "ring", label: "halka" }, { value: "blink", label: "yanıp sönme" }, { value: "off", label: "yok" }] },
    { key: "size", label: "Boyut", default: "md", options: ["xs", "sm", "md", "lg"] },
    { key: "label", label: "Erişilebilir etiket", default: true },
  ],
});
