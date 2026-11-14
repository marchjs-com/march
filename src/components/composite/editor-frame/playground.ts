import { definePlayground } from "../../meta.ts";

interface Values { head: boolean; actions: boolean; foot: boolean; sticky: boolean; ring: boolean; color: string; state: string }

export default definePlayground<Values>({
  options: [
    { key: "head", label: "Üst çubuk", default: true },
    { key: "actions", label: "Üst çubukta eylem (kelime rozeti)", default: true, visibleWhen: (v) => v.head },
    { key: "sticky", label: "Üst çubuk kaydırırken yapışır", default: false, visibleWhen: (v) => v.head },
    { key: "foot", label: "Alt çubuk", default: true },
    { key: "ring", label: "Odak halkası", default: true },
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "vurgu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-green", label: "yeşil" }, { value: "brand-purple", label: "mor" }], prop: "m:color" },
    { key: "state", label: "Durum", default: "normal", options: [{ value: "normal", label: "normal" }, { value: "readonly", label: "salt okunur" }, { value: "disabled", label: "devre dışı" }] },
  ],
});
