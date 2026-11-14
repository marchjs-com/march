import { definePlayground } from "../../meta.ts";

interface Values { checks: string; subs: boolean; kind: string; trigger: string; variant: string; color: string }

export default definePlayground<Values>({
  options: [
    { key: "kind", label: "Tür", default: "menu", options: [{ value: "menu", label: "Menu" }, { value: "dropdown", label: "Dropdown" }] },
    { key: "checks", label: "İşaretli öğeler", default: "radio", kind: "segmented", options: [{ value: "off", label: "yok" }, { value: "radio", label: "tek seçim (radyo)" }, { value: "checkbox", label: "aç / kapat" }], visibleWhen: (v) => v.kind === "menu" },
    { key: "subs", label: "Açıklama satırı ve bulunulan öğe", default: false, visibleWhen: (v) => v.kind === "menu" },
    { key: "trigger", label: "Tetik", default: "label", options: [{ value: "label", label: "metin" }, { value: "icon", label: "ikon" }] },
    { key: "variant", label: "Tetik görünümü", default: "secondary", options: ["secondary", "primary", "ghost", "dark"], visibleWhen: (v) => v.trigger === "label" },
    { key: "color", label: "Tetik rengi", default: "", options: [{ value: "", label: "tema" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }], visibleWhen: (v) => v.trigger === "icon" || v.variant === "primary" },
  ],
});
