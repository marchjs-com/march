import { definePlayground } from "../../meta.ts";

interface Values { value: string; variant: string; size: string; text: boolean; icons: string; color: string }

export default definePlayground<Values>({
  options: [
    { key: "value", label: "Değer", default: "yes", options: [{ value: "yes", label: "evet" }, { value: "no", label: "hayır" }, { value: "partial", label: "kısmen" }] },
    { key: "variant", label: "Görünüm", default: "plain", options: [{ value: "plain", label: "yalın" }, { value: "soft", label: "yumuşak disk" }, { value: "solid", label: "dolu disk" }] },
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md", "lg"] },
    { key: "text", label: "Metni göster", default: false },
    { key: "icons", label: "İşaretler", default: "default", options: [{ value: "default", label: "hazır" }, { value: "own", label: "kendi ikonlarım" }, { value: "emoji", label: "metin (👍 👎 ~)" }] },
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "değere göre" }, { value: "primary", label: "vurgu" }, { value: "brand-purple", label: "mor" }, { value: "neutral", label: "nötr" }] },
  ],
});
