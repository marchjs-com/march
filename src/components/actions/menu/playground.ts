import { definePlayground } from "../../meta.ts";

interface Values { kind: string; trigger: string; variant: string; color: string }

export default definePlayground<Values>({
  options: [
    { key: "kind", label: "Tür", default: "menu", options: [{ value: "menu", label: "Menu" }, { value: "dropdown", label: "Dropdown" }] },
    { key: "trigger", label: "Tetik", default: "label", options: [{ value: "label", label: "metin" }, { value: "icon", label: "ikon" }] },
    { key: "variant", label: "Tetik görünümü", default: "secondary", options: ["secondary", "primary", "ghost", "dark"], visibleWhen: (v) => v.trigger === "label" },
    { key: "color", label: "Tetik rengi", default: "", options: [{ value: "", label: "tema" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }], visibleWhen: (v) => v.trigger === "icon" || v.variant === "primary" },
  ],
});
