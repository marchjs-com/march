import { definePlayground } from "../../meta.ts";

interface Values { kind: string; size: string; icon: boolean; subtitle: boolean; meta: boolean; actions: boolean; close: string; divider: boolean; tone: string; color: string }

export default definePlayground<Values>({
  options: [
    { key: "kind", label: "Yer", default: "header", options: [{ value: "header", label: "üst çubuk" }, { value: "footer", label: "alt çubuk" }] },
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md", "lg"] },
    { key: "icon", label: "İkon", default: true },
    { key: "color", label: "İkon rengi", default: "none", options: [{ value: "none", label: "soluk" }, { value: "primary", label: "aksan" }, { value: "brand-orange", label: "turuncu" }, { value: "success", label: "yeşil" }], visibleWhen: (v) => v.icon, prop: "m:color" },
    { key: "subtitle", label: "Alt başlık", default: true },
    { key: "meta", label: "Sayı rozeti", default: false },
    { key: "actions", label: "Eylemler", default: true },
    { key: "close", label: "Kapat düğmesi", default: "on", options: [{ value: "on", label: "var" }, { value: "own", label: "kendi ikonum" }, { value: "off", label: "yok" }] },
    { key: "divider", label: "Ayırıcı çizgi", default: true },
    { key: "tone", label: "Zemin", default: "plain", options: [{ value: "plain", label: "düz" }, { value: "muted", label: "soluk (düzenleyici)" }] },
  ],
});
