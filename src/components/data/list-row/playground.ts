import { definePlayground } from "../../meta.ts";

interface Values { kind: string; lead: string; sub: boolean; trail: string; size: string; color: string; overflow: string; indicator: boolean; disabled: boolean }

export default definePlayground<Values>({
  options: [
    { key: "kind", label: "Satır türü", default: "button", options: [{ value: "button", label: "düğme (onClick)" }, { value: "link", label: "bağlantı (href)" }, { value: "option", label: "seçenek (li role=option)" }, { value: "static", label: "düz" }] },
    { key: "lead", label: "Baş yuva", default: "icon", options: [{ value: "icon", label: "ikon" }, { value: "avatar", label: "avatar" }, { value: "dot", label: "durum noktası" }, { value: "emoji", label: "emoji" }, { value: "none", label: "yok" }] },
    { key: "sub", label: "Alt metin", default: true },
    { key: "trail", label: "Son yuva", default: "badge", options: [{ value: "badge", label: "rozet" }, { value: "kbd", label: "kısayol" }, { value: "chevron", label: "ok" }, { value: "actions", label: "eylem düğmesi" }, { value: "none", label: "yok" }] },
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md", "lg"] },
    { key: "color", label: "Etkin rengi", default: "", options: [{ value: "", label: "vurgu" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }] },
    { key: "overflow", label: "Sığmayan metin", default: "scroll", options: [{ value: "scroll", label: "kayar" }, { value: "ellipsis", label: "üç nokta" }, { value: "wrap", label: "alt satıra geçer" }] },
    { key: "indicator", label: "Etkin çubuğu", default: false },
    { key: "disabled", label: "Üçüncü satır devre dışı", default: false },
  ],
});
